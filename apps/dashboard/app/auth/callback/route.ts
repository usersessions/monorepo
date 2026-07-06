import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

const ADMIN_EMAIL = 'info@usersessions.io'

/**
 * Handles both magic link and Google OAuth callbacks.
 * NON-NEGOTIABLE (BUILD_SPEC §6): a profiles row is ensured on every sign-in.
 * Google OAuth is open to all users. The admin role is pinned server-side to the
 * admin email only — /admin routes are gated by the role check, never by which
 * sign-in method was used. Supports a sanitized internal ?next= redirect
 * (used by /rx to land on /admin).
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const nextParam = searchParams.get('next')
  const next = nextParam && nextParam.startsWith('/') && !nextParam.startsWith('//') ? nextParam : '/'

  if (code) {
    const supabase = await createClient()
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error && data.user) {
      const email = (data.user.email ?? '').toLowerCase()

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

      // Suspended accounts cannot sign in (admin suspension, audited).
      const { data: gate } = await supabase
        .from('profiles')
        .select('suspended_at')
        .eq('id', data.user.id)
        .maybeSingle()
      if (gate?.suspended_at) {
        await supabase.auth.signOut()
        return NextResponse.redirect(`${origin}/login?error=suspended`)
      }

      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth`)
}
