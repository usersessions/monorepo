import { NextResponse } from 'next/server'
import { isEnabled } from '@/lib/flags'
import { initializeTransaction, planCode, type PaidPlanKey } from '@/lib/billing/paystack'
import { createClient } from '@/lib/supabase/server'

const PAID_PLANS: PaidPlanKey[] = ['founder_monthly', 'founder_annual', 'agency_monthly']

export async function POST(request: Request) {
  // Flag-gated end to end: with billing off this endpoint does not exist in practice.
  if (!(await isEnabled('billing'))) {
    return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 })
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const origin = new URL(request.url).origin
  if (!user) return NextResponse.redirect(`${origin}/login`, 303)

  const form = await request.formData()
  const plan = String(form.get('plan') ?? '') as PaidPlanKey
  // Failures 303 back to /pricing with a readable banner — a form POST must
  // never strand the user on a raw JSON response.
  if (!PAID_PLANS.includes(plan)) {
    return NextResponse.redirect(`${origin}/pricing?checkout_error=invalid_plan`, 303)
  }

  const code = planCode(plan)
  if (!code) {
    // Name the failing plan so /pricing can say exactly which env var is missing.
    return NextResponse.redirect(`${origin}/pricing?checkout_error=not_configured&plan=${plan}`, 303)
  }

  const { data: profile } = await supabase.from('profiles').select('email').eq('id', user.id).single()
  if (!profile?.email) return NextResponse.redirect(`${origin}/login`, 303)

  const result = await initializeTransaction({
    email: profile.email,
    planCode: code,
    userId: user.id,
    callbackUrl: `${process.env.NEXT_PUBLIC_SITE_URL ?? origin}/?billing=success`,
  })
  if (!('authorizationUrl' in result)) {
    // Surface the provider's reason so /pricing can show an actionable banner.
    return NextResponse.redirect(
      `${origin}/pricing?checkout_error=failed&reason=${encodeURIComponent(result.error)}`,
      303
    )
  }

  return NextResponse.redirect(result.authorizationUrl, 303)
}
