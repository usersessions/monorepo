import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

const ADMIN_EMAIL = 'info@usersessions.io'

/**
 * Handles both magic link and Google OAuth callbacks.
 * NON-NEGOTIABLE (BUILD_SPEC §6): a profiles row is ensured on every sign-in.
 * Google OAuth is the admin's door ONLY: any other Google sign-in is rejected
 * server-side (signed out immediately), never merely hidden client-side.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')

  if (code) {
    const supabase = await createClient()
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error && data.user) {
      const email = (data.user.email ?? '').toLowerCase()
      const provider = data.user.app_metadata?.provider

      if (provider === 'google' && email !== ADMIN_EMAIL) {
        await supabase.auth.signOut()
        return NextResponse.redirect(`${origin}/login?error=google_admin_only`)
      }

      await supabase
        .from('profiles')
        .upsert(
          {
            id: data.user.id,
            email: data.user.email ?? '',
            full_name: (data.user.user_metadata?.full_name as string | undefined) ?? null,
          },
          { onConflict: 'id', ignoreDuplicates: true }
        )

      // Admin role is pinned to the admin email — idempotent, via service role
      // (RLS keeps users from self-promoting).
      if (email === ADMIN_EMAIL) {
        const db = createServiceClient()
        await db.from('profiles').update({ role: 'admin' }).eq('id', data.user.id).neq('role', 'admin')
      }

      return NextResponse.redirect(`${origin}/`)
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth`)
}
