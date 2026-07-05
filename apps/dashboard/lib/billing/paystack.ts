import crypto from 'crypto'

/**
 * Paystack integration (BUILD_SPEC §11). Subscription-only — no one-time SKU exists.
 * Plan codes are created in the Paystack dashboard and provided via env vars.
 * PRE-LAUNCH GATE: confirm settlement currency approval before flipping the billing flag.
 */

const API = 'https://api.paystack.co'

export type PaidPlanKey = 'founder_monthly' | 'founder_annual' | 'agency_monthly'

const PLAN_ENV: Record<PaidPlanKey, string> = {
  founder_monthly: 'PAYSTACK_PLAN_FOUNDER_MONTHLY',
  founder_annual: 'PAYSTACK_PLAN_FOUNDER_ANNUAL',
  agency_monthly: 'PAYSTACK_PLAN_AGENCY_MONTHLY',
}

export function planCode(key: PaidPlanKey): string | null {
  return process.env[PLAN_ENV[key]] ?? null
}

/** Reverse mapping: Paystack plan_code → our PlanId, for webhook processing. */
export function planIdFromCode(code: string | null | undefined): 'founder' | 'agency' | null {
  if (!code) return null
  if (code === process.env.PAYSTACK_PLAN_FOUNDER_MONTHLY || code === process.env.PAYSTACK_PLAN_FOUNDER_ANNUAL)
    return 'founder'
  if (code === process.env.PAYSTACK_PLAN_AGENCY_MONTHLY) return 'agency'
  return null
}

export async function initializeTransaction(input: {
  email: string
  planCode: string
  userId: string
  callbackUrl: string
}): Promise<{ authorizationUrl: string } | null> {
  const secret = process.env.PAYSTACK_SECRET_KEY
  if (!secret) return null

  try {
    const res = await fetch(`${API}/transaction/initialize`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${secret}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: input.email,
        plan: input.planCode,
        metadata: { user_id: input.userId },
        callback_url: input.callbackUrl,
      }),
    })
    if (!res.ok) return null
    const payload = await res.json()
    const url = payload?.data?.authorization_url
    return typeof url === 'string' ? { authorizationUrl: url } : null
  } catch {
    return null
  }
}

/** Paystack signs webhooks with your secret key: HMAC-SHA512 over the raw body. */
export function verifyWebhookSignature(rawBody: string, signature: string | null): boolean {
  const secret = process.env.PAYSTACK_SECRET_KEY
  if (!secret || !signature) return false
  const expected = crypto.createHmac('sha512', secret).update(rawBody).digest('hex')
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature))
  } catch {
    return false
  }
}
