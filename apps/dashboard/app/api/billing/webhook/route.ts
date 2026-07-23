import { NextResponse } from 'next/server'
import { disableSubscription, planIdFromCode, verifyWebhookSignature } from '@/lib/billing/paystack'
import { sendEmail } from '@/lib/email/resend'
import { dataTable, escapeHtml, renderEmail } from '@/lib/email/template'
import { createServiceClient } from '@/lib/supabase/server'
import { creditManager } from '@/services/credits'

// Force dynamic so Next.js never tries to statically collect this route at
// build time (Supabase URL is a runtime env var on Cloudflare, not a build var).
export const dynamic = 'force-dynamic'

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

  // Initialized here (not at module level) so it only runs at request time,
  // not during Next.js static page-data collection at build time.
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
        // Immediately sync credits to the new plan (do not wait for lazy monthly reset)
        if (plan) await creditManager.handlePlanChange(userId, plan).catch(console.error)
        await db.from('revenue_events').insert({
          user_id: userId,
          event_type: 'payment_succeeded',
          amount: typeof data.amount === 'number' ? data.amount / 100 : null, // Paystack sends subunits
          ...(data.currency ? { currency: data.currency } : {}),
          paystack_reference: data.reference ?? null,
        })
        // Payment receipt — design-system email, always fail-soft.
        if (data.customer?.email) {
          const amount = typeof data.amount === 'number' ? (data.amount / 100).toFixed(2) : null
          await sendEmail({
            to: data.customer.email,
            subject: 'Payment received — usersessions',
            html: renderEmail({
              title: 'Payment received',
              heroTitle: 'Payment received',
              heroSubtitle: 'Your subscription is active. Your receipt is below.',
              bodyHtml: dataTable([
                ['Amount', amount ? escapeHtml(`${amount} ${String(data.currency ?? '')}`.trim()) : '—'],
                ['Plan', escapeHtml(plan ?? 'subscription')],
                ['Reference', escapeHtml(String(data.reference ?? '—'))],
              ]),
              cta: {
                label: 'Open your dashboard',
                href: process.env.NEXT_PUBLIC_SITE_URL ?? 'https://usersessions.io',
              },
            }),
          })
        }
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
        // Immediately sync credits to the new plan (do not wait for lazy monthly reset)
        if (plan) await creditManager.handlePlanChange(userId, plan).catch(console.error)
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
        // Immediately reset credits to free tier
        if (target?.id) await creditManager.handlePlanChange(target.id, 'free').catch(console.error)
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
          // Dunning email — the user must hear it from us before their plan lapses.
          const { data: failedProfile } = await db
            .from('profiles')
            .select('email')
            .eq('id', failedUserId)
            .maybeSingle()
          const toEmail = data.customer?.email ?? failedProfile?.email
          if (toEmail) {
            await sendEmail({
              to: toEmail,
              subject: 'Payment failed — action needed',
              html: renderEmail({
                title: 'Payment failed',
                heroTitle: 'Your payment did not go through',
                heroSubtitle: 'Nothing is lost — the charge will be retried automatically.',
                bodyHtml:
                  '<p style="margin:0;">Your plan stays active while we retry. If payment keeps failing, your account moves to the free plan and live monitoring pauses — update your card to keep everything running.</p>',
                cta: {
                  label: 'Review billing in Settings',
                  href: `${process.env.NEXT_PUBLIC_SITE_URL ?? 'https://usersessions.io'}/settings`,
                },
              }),
            })
          }
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
