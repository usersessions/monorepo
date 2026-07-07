import { requireAdmin } from '@/lib/admin'
import { createServiceClient } from '@/lib/supabase/server'
import FreshnessTimestamp from '@/components/admin/FreshnessTimestamp'
import MetricCard, { type Metric } from '@/components/admin/MetricCard'
import RealtimeIndicator from '@/components/admin/RealtimeIndicator'
import RefreshButton from '@/components/admin/RefreshButton'
import TimeRangeToggle from '@/components/admin/TimeRangeToggle'

// List prices (BUILD_SPEC §11). MRR here is an estimate computed from active paid
// plan rows — annual subscribers are counted at monthly list price. Paystack is
// the billing source of truth; this view is directional, and labeled as such.
const PLAN_PRICE_USD = { founder: 39, agency: 199 } as const

const RANGES = { '24h': 864e5, '7d': 7 * 864e5, '30d': 30 * 864e5, '90d': 90 * 864e5 } as const
type Range = keyof typeof RANGES

function deltaPct(current: number, previous: number): number | null {
  if (previous <= 0) return null
  return ((current - previous) / previous) * 100
}

export default async function AdminSystemPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}) {
  await requireAdmin()
  const db = createServiceClient()

  const sp = (await searchParams) ?? {}
  const rawRange = Array.isArray(sp.range) ? sp.range[0] : sp.range
  const range: Range = rawRange && rawRange in RANGES ? (rawRange as Range) : '7d'
  const rangeMs = RANGES[range]

  const now = new Date()
  const todayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
  const yesterdayStart = new Date(todayStart.getTime() - 864e5)
  const rangeStart = new Date(Date.now() - rangeMs)
  const prevRangeStart = new Date(Date.now() - 2 * rangeMs)

  const [
    { data: cronLogs },
    { count: pendingAdapters },
    { count: queuedResubs },
    { count: userCount },
    { count: founderCount },
    { count: agencyCount },
    { count: signupsToday },
    { count: signupsYesterday },
    { count: signupsRange },
    { count: signupsPrevRange },
    { count: runningCampaigns },
    { data: rangeProfiles },
  ] = await Promise.all([
    db.from('cron_logs').select('job_name, status, detail, ran_at').order('ran_at', { ascending: false }).limit(20),
    db.from('adapter_runs').select('*', { count: 'exact', head: true }).eq('status', 'pending_review'),
    db.from('resubmission_queue').select('*', { count: 'exact', head: true }).eq('status', 'queued'),
    db.from('profiles').select('*', { count: 'exact', head: true }),
    db.from('profiles').select('*', { count: 'exact', head: true }).eq('plan', 'founder').eq('subscription_status', 'active'),
    db.from('profiles').select('*', { count: 'exact', head: true }).eq('plan', 'agency').eq('subscription_status', 'active'),
    db.from('profiles').select('*', { count: 'exact', head: true }).gte('created_at', todayStart.toISOString()),
    db.from('profiles').select('*', { count: 'exact', head: true }).gte('created_at', yesterdayStart.toISOString()).lt('created_at', todayStart.toISOString()),
    db.from('profiles').select('*', { count: 'exact', head: true }).gte('created_at', rangeStart.toISOString()),
    db.from('profiles').select('*', { count: 'exact', head: true }).gte('created_at', prevRangeStart.toISOString()).lt('created_at', rangeStart.toISOString()),
    db.from('campaigns').select('*', { count: 'exact', head: true }).eq('status', 'running'),
    db.from('profiles').select('created_at').gte('created_at', rangeStart.toISOString()).limit(5000),
  ])

  const paid = (founderCount ?? 0) + (agencyCount ?? 0)
  const mrr = (founderCount ?? 0) * PLAN_PRICE_USD.founder + (agencyCount ?? 0) * PLAN_PRICE_USD.agency
  const conversion = userCount ? Math.round((paid / userCount) * 1000) / 10 : 0

  // 7-point signup sparkline across the selected range.
  const spark = new Array<number>(7).fill(0)
  const bucketMs = rangeMs / 7
  for (const row of rangeProfiles ?? []) {
    const idx = Math.min(6, Math.floor((new Date(row.created_at).getTime() - rangeStart.getTime()) / bucketMs))
    if (idx >= 0) spark[idx] += 1
  }

  const usersPrev = (userCount ?? 0) - (signupsRange ?? 0)

  // Latest run per job
  const latestByJob = new Map<string, NonNullable<typeof cronLogs>[number]>()
  for (const log of cronLogs ?? []) {
    if (!latestByJob.has(log.job_name)) latestByJob.set(log.job_name, log)
  }

  // Deltas needing plan/revenue history stay null (grey dash) until revenue_events accrues data.
  const metrics: Metric[] = [
    { label: 'MRR', value: `$${mrr.toLocaleString()}`, sub: 'Estimated from active plan rows', delta: null, period: range },
    { label: 'Paid subscribers', value: paid, delta: null, period: range },
    { label: 'Free → paid', value: `${conversion}%`, delta: null, period: range },
    { label: 'Signups today', value: signupsToday ?? 0, delta: deltaPct(signupsToday ?? 0, signupsYesterday ?? 0), period: 'day' },
    { label: `Signups, ${range}`, value: signupsRange ?? 0, delta: deltaPct(signupsRange ?? 0, signupsPrevRange ?? 0), period: range, spark },
    { label: 'Users', value: userCount ?? 0, delta: deltaPct(userCount ?? 0, usersPrev), period: range },
    { label: 'Adapter runs pending review', value: pendingAdapters ?? 0, delta: null, period: '24h' },
    { label: 'Resubmissions queued', value: queuedResubs ?? 0, delta: null, period: '24h' },
    { label: 'Active campaigns', value: runningCampaigns ?? 0, delta: null, period: range },
  ]

  return (
    <div className="flex flex-col" style={{ gap: 'var(--space-lg)' }}>
      <div className="flex" style={{ justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--space-md)' }}>
        <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.75rem' }}>System</h1>
        <div className="flex" style={{ alignItems: 'center', gap: 'var(--space-md)' }}>
          <TimeRangeToggle />
          <RealtimeIndicator />
          <RefreshButton />
        </div>
      </div>
      <FreshnessTimestamp generatedAt={new Date().toISOString()} />

      <div className="grid grid-cols-1 md:grid-cols-3" style={{ gap: 'var(--space-md)' }}>
        {metrics.map((m) => (
          <MetricCard key={m.label} {...m} />
        ))}
      </div>

      <div className="card card--dense">
        <p className="font-mono-label" style={{ marginBottom: 'var(--space-md)' }}>Cron jobs — last runs</p>
        {latestByJob.size === 0 ? (
          <p className="font-sans-body">No cron runs logged yet.</p>
        ) : (
          [...latestByJob.values()].map((log) => (
            <div key={log.job_name} className="flex" style={{ gap: 'var(--space-md)', borderTop: '1px solid var(--border)', padding: 'var(--space-sm) 0' }}>
              <span className="font-mono-data" style={{ flex: 1 }}>{log.job_name}</span>
              <span className={log.status === 'ok' ? 'status-live' : 'status-dead'}>{log.status}</span>
              <span className="font-mono-micro">{new Date(log.ran_at).toISOString().replace('T', ' ').slice(0, 16)}</span>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
