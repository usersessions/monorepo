import { NextResponse } from 'next/server'
import { planIdFromCode, verifyWebhookSignature } from '@/lib/billing/paystack'
import { createServiceClient } from '@/lib/supabase/server'

/**
 * Paystack webhook (BUILD_SPEC §11): signature-verified (HMAC-SHA512 over the raw body),
 * handles charge.success, subscription.create, subscription.disable, invoice.payment_failed.
 * Stores email_token — required alongside subscription_code to cancel later.
 */
export async function POST(request: Request) {
  const raw = await request.text()
  if (!verifyWebhookSignature(raw, request.headers.get('x-paystack-signature'))) {
    return NextResponse.json({ error: 'INVALID_SIGNATURE' }, { status: 401 })
  }

  let event: { event?: string; data?: Record<string, unknown> }
  try {
    event = JSON.parse(raw)
  } catch {
    return NextResponse.json({ error: 'INVALID_PAYLOAD' }, { status: 400 })
  }

  const db = createServiceClient()
  const data = (event.data ?? {}) as {
    metadata?: { user_id?: string }
    customer?: { customer_code?: string; email?: string }
    subscription_code?: string
    email_token?: string
    plan?: { plan_code?: string }
    subscription?: { subscription_code?: string }
  }

  async function findUserId(): Promise<string | null> {
    if (data.metadata?.user_id) return data.metadata.user_id
    if (data.customer?.email) {
      const { data: profile } = await db
        .from('profiles')
        .select('id')
        .eq('email', data.customer.email)
        .maybeSingle()
      return profile?.id ?? null
    }
    return null
  }

  try {
    switch (event.event) {
      case 'charge.success': {
        const userId = await findUserId()
        if (!userId) break
        const plan = planIdFromCode(data.plan?.plan_code)
        await db
          .from('profiles')
          .update({
            paystack_customer_code: data.customer?.customer_code ?? null,
            subscription_status: 'active',
            ...(plan ? { plan } : {}),
          })
          .eq('id', userId)
        break
      }

      case 'subscription.create': {
        const userId = await findUserId()
        if (!userId) break
        const plan = planIdFromCode(data.plan?.plan_code)
        await db
          .from('profiles')
          .update({
            paystack_customer_code: data.customer?.customer_code ?? null,
            paystack_subscription_code: data.subscription_code ?? null,
            paystack_email_token: data.email_token ?? null, // needed for cancellation
            subscription_status: 'active',
            ...(plan ? { plan } : {}),
          })
          .eq('id', userId)
        break
      }

      case 'subscription.disable': {
        const code = data.subscription_code ?? data.subscription?.subscription_code
        if (!code) break
        // v1 policy: disable = immediate downgrade to free. Revisit for period-end grace.
        await db
          .from('profiles')
          .update({ subscription_status: 'cancelled', plan: 'free' })
          .eq('paystack_subscription_code', code)
        break
      }

      case 'invoice.payment_failed': {
        const code = data.subscription?.subscription_code ?? data.subscription_code
        if (code) {
          await db.from('profiles').update({ subscription_status: 'attention' }).eq('paystack_subscription_code', code)
        } else {
          const userId = await findUserId()
          if (userId) await db.from('profiles').update({ subscription_status: 'attention' }).eq('id', userId)
        }
        break
      }

      default:
        break // unknown events acknowledged, not processed
    }
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[billing/webhook] processing failed:', err)
    return NextResponse.json({ ok: false }, { status: 500 }) // Paystack retries on non-200
  }
}
