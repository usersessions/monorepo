import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { PLANS, PlanId } from '@/lib/tiers'
import { initializeTransaction } from '@/lib/billing/paystack'

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { planId, billingCycle = 'monthly' }: { planId: PlanId; billingCycle: 'monthly' | 'annual' } = body

    // Validate plan — free is not purchasable; agency routes to /support on the frontend
    if (!PLANS[planId] || planId === 'free') {
      return NextResponse.json({ error: 'Invalid plan' }, { status: 400 })
    }

    // Resolve Paystack plan code from env vars explicitly for Cloudflare bundler compatibility
    // Using hardcoded fallbacks based on the provided Cloudflare screenshot to guarantee it works
    let paystackPlanCode = undefined;
    if (planId === 'starter') {
      paystackPlanCode = billingCycle === 'annual' 
        ? (process.env.PAYSTACK_PLAN_STARTER_ANNUAL || 'PLN_hnmf9lejvqrtjyi')
        : (process.env.PAYSTACK_PLAN_STARTER_MONTHLY || 'PLN_enjmtzib9iu9ld4');
    } else if (planId === 'pro') {
      paystackPlanCode = billingCycle === 'annual' 
        ? (process.env.PAYSTACK_PLAN_PRO_ANNUAL || 'PLN_bix9km6ubnr204y')
        : (process.env.PAYSTACK_PLAN_PRO_MONTHLY || 'PLN_hkld9ablhk6t487');
    }

    if (!paystackPlanCode) {
      console.error(`[Billing] Missing env var for ${planId} ${billingCycle}`)
      return NextResponse.json({ error: 'Plan not configured' }, { status: 500 })
    }

    // Fetch the profile email as fallback (auth.users email is canonical)
    const { data: profile } = await supabase
      .from('profiles')
      .select('email')
      .eq('id', user.id)
      .single()

    const email = user.email ?? profile?.email
    if (!email) {
      return NextResponse.json({ error: 'User has no email' }, { status: 400 })
    }

    // Build the callback URL Paystack redirects to after the customer pays.
    // The webhook handles the actual plan/credit update — this just closes the Paystack popup.
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://usersessions.io'
    const callbackUrl = `${siteUrl}/settings?billing=success`

    // Initialize a Paystack transaction (returns an authorization_url to redirect the user to)
    const result = await initializeTransaction({
      email,
      planCode: paystackPlanCode,
      userId: user.id,
      callbackUrl,
    })

    if ('error' in result) {
      console.error('[Billing] initializeTransaction failed:', result.error)
      return NextResponse.json({ error: result.error }, { status: 502 })
    }

    return NextResponse.json({ authorizationUrl: result.authorizationUrl })
  } catch (error: any) {
    console.error('[Billing] Checkout error:', error)
    return NextResponse.json({ error: error.message ?? 'Checkout failed' }, { status: 500 })
  }
}
