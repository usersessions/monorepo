import { requireAdmin } from '@/lib/admin'
import { createServiceClient } from '@/lib/supabase/server'

import { PLANS, type PlanId } from '@/lib/tiers'

// MRR is an estimate from active paid plan rows priced from PLANS; Paystack is
// the billing source of truth. Revenue figures come from real revenue_events
// written by the webhook — nothing here is fabricated.
const PAID_PLANS: PlanId[] = ['starter', 'pro', 'agency']

export default async function AdminBillingPage() {
  await requireAdmin()
  const db = createServiceClient()
  const since30 = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString()

  const [{ count: starterCount }, { count: proCount }, { count: agencyCount }, { data: events }, { data: paidProfiles }] =
    await Promise.all([
      db.from('profiles').select('*', { count: 'exact', head: true }).eq('plan', 'starter').eq('subscription_status', 'active'),
      db.from('profiles').select('*', { count: 'exact', head: true }).eq('plan', 'pro').eq('subscription_status', 'active'),
      db.from('profiles').select('*', { count: 'exact', head: true }).eq('plan', 'agency').eq('subscription_status', 'active'),
      db
        .from('revenue_events')
        .select('user_id, event_type, amount, currency, paystack_reference, created_at')
        .order('created_at', { ascending: false })
        .limit(50),
      db
        .from('profiles')
        .select('id, email, plan, subscription_status, created_at')
        .neq('plan', 'free')
        .order('created_at', { ascending: false })
        .limit(100),
    ])

  const emailById = new Map((paidProfiles ?? []).map((p) => [p.id, p.email]))
  const recent = events ?? []
  const succeeded30 = recent.filter((e) => e.event_type === 'payment_succeeded' && e.created_at >= since30)
  const failed30 = recent.filter((e) => e.event_type === 'payment_failed' && e.created_at >= since30).length
  const cancelled30 = recent.filter((e) => e.event_type === 'subscription_cancelled' && e.created_at >= since30).length
  const revenue30 = succeeded30.reduce((sum, e) => sum + Number(e.amount ?? 0), 0)
  const currencies = [...new Set(succeeded30.map((e) => e.currency).filter(Boolean))]
  const planCounts: Record<PlanId, number> = { free: 0, starter: starterCount ?? 0, pro: proCount ?? 0, agency: agencyCount ?? 0 }
  const mrr = PAID_PLANS.reduce((sum, p) => sum + planCounts[p] * (PLANS[p].price.monthly / 100), 0)

  // Checkout charges amounts straight from PLANS — no Paystack plan codes needed.
  const envChecks: [string, boolean][] = [
    ['PAYSTACK_SECRET_KEY', Boolean(process.env.PAYSTACK_SECRET_KEY)],
  ]

  return (
    <div className="flex flex-col" style={{ gap: 'var(--space-lg)' }}>
      <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.75rem' }}>Billing</h1>

      {/* Live env check, read at request time. Presence only — values are never shown. */}
      <div className="card card--dense">
        <p className="font-mono-label" style={{ marginBottom: 'var(--space-md)' }}>Paystack configuration</p>
        {envChecks.map(([name, set]) => (
          <div key={name} className="flex" style={{ gap: 'var(--space-md)', borderTop: '1px solid var(--border)', padding: 'var(--space-sm) 0' }}>
            <span className="font-mono-data" style={{ flex: 1 }}>{name}</span>
            <span className={set ? 'status-live' : 'status-dead'}>{set ? 'set' : 'missing'}</span>
          </div>
        ))}
        {envChecks.some(([, set]) => !set) && (
          <p className="font-mono-micro" style={{ paddingTop: 'var(--space-sm)', color: 'var(--amber)' }}>
            Missing values break checkout for the corresponding plan. Set them in Vercel (Production) and redeploy — env changes do not apply to running deployments.
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4" style={{ gap: 'var(--space-md)' }}>
        {[
          { label: 'MRR (est., plan rows)', value: `$${mrr.toLocaleString()}` },
          {
            label: `Revenue, 30d${currencies.length === 1 ? ` (${currencies[0]})` : currencies.length > 1 ? ' (mixed currencies)' : ''}`,
            value: revenue30.toLocaleString(),
          },
          { label: 'Failed payments, 30d', value: failed30 },
          { label: 'Cancellations, 30d', value: cancelled30 },
        ].map((m) => (
          <div key={m.label} className="card card--dense">
            <p className="font-mono-label">{m.label}</p>
            <p className="font-serif-metric">{m.value}</p>
          </div>
        ))}
      </div>

      <div className="card card--dense">
        <p className="font-mono-label" style={{ marginBottom: 'var(--space-md)' }}>Active subscriptions</p>
        {!paidProfiles || paidProfiles.length === 0 ? (
          <p className="font-sans-body">No paid subscriptions yet. They appear the moment the first live checkout completes.</p>
        ) : (
          paidProfiles.map((p) => (
            <div key={p.id} className="flex" style={{ gap: 'var(--space-md)', borderTop: '1px solid var(--border)', padding: 'var(--space-sm) 0', flexWrap: 'wrap' }}>
              <span className="font-mono-data" style={{ flex: 1, minWidth: 200 }}>{p.email}</span>
              <span className="font-mono-data" style={{ textTransform: 'capitalize' }}>{p.plan}</span>
              <span className={p.subscription_status === 'active' ? 'status-live' : p.subscription_status === 'attention' ? 'status-pending' : 'status-dead'}>
                {p.subscription_status}
              </span>
              <span className="font-mono-micro">{new Date(p.created_at).toISOString().slice(0, 10)}</span>
            </div>
          ))
        )}
      </div>

      <div className="card card--dense">
        <p className="font-mono-label" style={{ marginBottom: 'var(--space-md)' }}>Recent revenue events</p>
        {recent.length === 0 ? (
          <p className="font-sans-body">
            No revenue events yet — they are written by the Paystack webhook and appear the moment the first transaction lands.
          </p>
        ) : (
          recent.map((e, i) => (
            <div key={`${e.paystack_reference ?? 'ev'}-${i}`} className="flex" style={{ gap: 'var(--space-md)', borderTop: '1px solid var(--border)', padding: 'var(--space-sm) 0', flexWrap: 'wrap' }}>
              <span className="font-mono-micro" style={{ width: 130 }}>{new Date(e.created_at).toISOString().replace('T', ' ').slice(0, 16)}</span>
              <span className="font-mono-data" style={{ flex: 1, minWidth: 160 }}>{emailById.get(e.user_id) ?? `${String(e.user_id).slice(0, 8)}…`}</span>
              <span className={e.event_type === 'payment_failed' || e.event_type === 'subscription_cancelled' ? 'status-dead' : 'status-live'}>
                {e.event_type.replaceAll('_', ' ')}
              </span>
              <span className="font-mono-data">{e.amount != null ? `${Number(e.amount).toLocaleString()} ${e.currency ?? ''}` : '—'}</span>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
