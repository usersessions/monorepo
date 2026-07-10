import { NextResponse } from 'next/server'
import { disableSubscription, planIdFromCode, verifyWebhookSignature } from '@/lib/billing/paystack'
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
    amount?: number
    currency?: string
    reference?: string
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
        await db.from('revenue_events').insert({
          user_id: userId,
          event_type: 'payment_succeeded',
          amount: typeof data.amount === 'number' ? data.amount / 100 : null, // Paystack sends subunits
          ...(data.currency ? { currency: data.currency } : {}),
          paystack_reference: data.reference ?? null,
        })
        break
      }

      case 'subscription.create': {
        const userId = await findUserId()
        if (!userId) break
        const plan = planIdFromCode(data.plan?.plan_code)
        // Plan switch (upgrade or cancel-flow downgrade): turn off auto-renew on the
        // PREVIOUS subscription so the user is never double-billed.
        const { data: prev } = await db
          .from('profiles')
          .select('paystack_subscription_code, paystack_email_token')
          .eq('id', userId)
          .maybeSingle()
        if (
          prev?.paystack_subscription_code &&
          prev.paystack_email_token &&
          data.subscription_code &&
          prev.paystack_subscription_code !== data.subscription_code
        ) {
          await disableSubscription(prev.paystack_subscription_code, prev.paystack_email_token)
        }
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
        await db.from('revenue_events').insert({
          user_id: userId,
          event_type: 'subscription_created',
          paystack_reference: data.subscription_code ?? null,
        })
        break
      }

      case 'subscription.disable': {
        const code = data.subscription_code ?? data.subscription?.subscription_code
        if (!code) break
        const { data: target } = await db
          .from('profiles')
          .select('id')
          .eq('paystack_subscription_code', code)
          .maybeSingle()
        // v1 policy: disable = immediate downgrade to free. Revisit for period-end grace.
        await db
          .from('profiles')
          .update({ subscription_status: 'cancelled', plan: 'free' })
          .eq('paystack_subscription_code', code)
        if (target?.id) {
          await db.from('revenue_events').insert({
            user_id: target.id,
            event_type: 'subscription_cancelled',
            paystack_reference: code,
          })
        }
        break
      }

      case 'invoice.payment_failed': {
        const code = data.subscription?.subscription_code ?? data.subscription_code
        let failedUserId: string | null = null
        if (code) {
          const { data: target } = await db
            .from('profiles')
            .select('id')
            .eq('paystack_subscription_code', code)
            .maybeSingle()
          failedUserId = target?.id ?? null
          await db.from('profiles').update({ subscription_status: 'attention' }).eq('paystack_subscription_code', code)
        } else {
          failedUserId = await findUserId()
          if (failedUserId) await db.from('profiles').update({ subscription_status: 'attention' }).eq('id', failedUserId)
        }
        if (failedUserId) {
          await db.from('revenue_events').insert({
            user_id: failedUserId,
            event_type: 'payment_failed',
            paystack_reference: code ?? null,
          })
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
