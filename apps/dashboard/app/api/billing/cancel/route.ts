import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { disableSubscription } from '@/lib/billing/paystack'

/**
 * POST /api/billing/cancel — session-authenticated auto-renew cancellation.
 * Uses the paystack_email_token captured by the webhook (BUILD_SPEC §11).
 * Sets subscription_status='non_renewing'; plan access persists until period end
 * (the subscription.disable webhook downgrades the plan when Paystack confirms).
 */
export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.redirect(new URL('/login', request.url), 303)

  const db = createServiceClient()
  const { data: profile } = await db
    .from('profiles')
    .select('plan, paystack_subscription_code, paystack_email_token')
    .eq('id', user.id)
    .single()

  if (!profile || profile.plan === 'free' || !profile.paystack_subscription_code || !profile.paystack_email_token) {
    return NextResponse.redirect(new URL('/settings?cancel_error=1', request.url), 303)
  }

  const ok = await disableSubscription(profile.paystack_subscription_code, profile.paystack_email_token)
  if (!ok) return NextResponse.redirect(new URL('/settings?cancel_error=1', request.url), 303)

  await db.from('profiles').update({ subscription_status: 'non_renewing' }).eq('id', user.id)
  return NextResponse.redirect(new URL('/settings?cancelled=1', request.url), 303)
}
