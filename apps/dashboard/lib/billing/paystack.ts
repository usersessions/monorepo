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
}): Promise<{ authorizationUrl: string } | { error: string }> {
  const secret = process.env.PAYSTACK_SECRET_KEY
  if (!secret) {
    console.error('[Billing] Missing PAYSTACK_SECRET_KEY')
    return { error: 'missing_secret_key' }
  }

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

    if (!res.ok) {
      const errorText = await res.text()
      console.error(`[Billing] Paystack API rejected initialization (Status: ${res.status}):`, errorText)
      let message = ''
      try {
        message = String(JSON.parse(errorText)?.message ?? '')
      } catch {
        /* not JSON */
      }
      return { error: `provider ${res.status}${message ? `: ${message.slice(0, 140)}` : ''}` }
    }

    const payload = await res.json()
    const url = payload?.data?.authorization_url
    if (typeof url !== 'string') {
      console.error('[Billing] Paystack returned success but no authorization_url:', payload)
      return { error: 'no_authorization_url' }
    }
    return { authorizationUrl: url }
  } catch (err) {
    console.error('[Billing] Exception during Paystack initialization:', err)
    return { error: 'network_error' }
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

/**
 * Turn off auto-renew (BUILD_SPEC §11: email_token stored for cancellation).
 * The subscription stays active until the end of the paid period — Paystack's
 * subscription/disable semantics, mirrored as subscription_status='non_renewing'.
 */
export async function disableSubscription(code: string, emailToken: string): Promise<boolean> {
  const secret = process.env.PAYSTACK_SECRET_KEY
  if (!secret) return false
  try {
    const res = await fetch(`${API}/subscription/disable`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${secret}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, token: emailToken }),
    })
    if (!res.ok) return false
    const payload = await res.json()
    return Boolean(payload?.status)
  } catch {
    return false
  }
}

export interface BillingTransaction {
  reference: string
  amountSubunit: number
  currency: string
  status: string
  paidAt: string | null
  channel: string | null
}

/**
 * Last payments for a customer, for the Settings billing history.
 * Paystack's /transaction list filters by numeric customer ID, so we resolve
 * the stored customer code first. Read-only; ALWAYS fails soft to [] — a
 * Paystack outage must never take down the Settings page.
 */
export async function listTransactions(customerCode: string, limit = 12): Promise<BillingTransaction[]> {
  const secret = process.env.PAYSTACK_SECRET_KEY
  if (!secret) return []
  const headers = { Authorization: `Bearer ${secret}` }
  try {
    const custRes = await fetch(`${API}/customer/${encodeURIComponent(customerCode)}`, { headers })
    if (!custRes.ok) return []
    const cust = await custRes.json()
    const customerId = cust?.data?.id
    if (!customerId) return []

    const txRes = await fetch(`${API}/transaction?customer=${customerId}&perPage=${limit}`, { headers })
    if (!txRes.ok) return []
    const tx = await txRes.json()
    const rows: any[] = Array.isArray(tx?.data) ? tx.data : []
    return rows.map((t) => ({
      reference: String(t?.reference ?? ''),
      amountSubunit: Number(t?.amount ?? 0),
      currency: String(t?.currency ?? ''),
      status: String(t?.status ?? 'unknown'),
      paidAt: t?.paid_at ?? null,
      channel: t?.channel ?? null,
    }))
  } catch {
    return []
  }
}
