import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * Handles both magic link and Google OAuth callbacks.
 * NON-NEGOTIABLE (BUILD_SPEC §6): a profiles row is ensured on every sign-in.
 * Every later page assumes it exists. ignoreDuplicates keeps plan/role untouched on repeat sign-ins.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')

  if (code) {
    const supabase = await createClient()
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error && data.user) {
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
      return NextResponse.redirect(`${origin}/`)
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth`)
}
