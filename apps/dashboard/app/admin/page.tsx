import { requireAdmin } from '@/lib/admin'
import { createServiceClient } from '@/lib/supabase/server'

// List prices (BUILD_SPEC §11). MRR here is an estimate computed from active paid
// plan rows — annual subscribers are counted at monthly list price. Paystack is
// the billing source of truth; this view is directional, and labeled as such.
const PLAN_PRICE_USD = { founder: 39, agency: 199 } as const

export default async function AdminSystemPage() {
  await requireAdmin()
  const db = createServiceClient()

  const now = new Date()
  const todayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).toISOString()
  const weekAgo = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString()

  const [
    { data: cronLogs },
    { count: pendingAdapters },
    { count: queuedResubs },
    { count: userCount },
    { count: founderCount },
    { count: agencyCount },
    { count: signupsToday },
    { count: signupsWeek },
  ] = await Promise.all([
    db.from('cron_logs').select('job_name, status, detail, ran_at').order('ran_at', { ascending: false }).limit(20),
    db.from('adapter_runs').select('*', { count: 'exact', head: true }).eq('status', 'pending_review'),
    db.from('resubmission_queue').select('*', { count: 'exact', head: true }).eq('status', 'queued'),
    db.from('profiles').select('*', { count: 'exact', head: true }),
    db.from('profiles').select('*', { count: 'exact', head: true }).eq('plan', 'founder').eq('subscription_status', 'active'),
    db.from('profiles').select('*', { count: 'exact', head: true }).eq('plan', 'agency').eq('subscription_status', 'active'),
    db.from('profiles').select('*', { count: 'exact', head: true }).gte('created_at', todayStart),
    db.from('profiles').select('*', { count: 'exact', head: true }).gte('created_at', weekAgo),
  ])

  const paid = (founderCount ?? 0) + (agencyCount ?? 0)
  const mrr = (founderCount ?? 0) * PLAN_PRICE_USD.founder + (agencyCount ?? 0) * PLAN_PRICE_USD.agency
  const conversion = userCount ? Math.round((paid / userCount) * 1000) / 10 : 0

  // Latest run per job
  const latestByJob = new Map<string, NonNullable<typeof cronLogs>[number]>()
  for (const log of cronLogs ?? []) {
    if (!latestByJob.has(log.job_name)) latestByJob.set(log.job_name, log)
  }

  return (
    <div className="flex flex-col" style={{ gap: 'var(--space-lg)' }}>
      <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.75rem' }}>System</h1>

      <div className="grid grid-cols-1 md:grid-cols-3" style={{ gap: 'var(--space-md)' }}>
        {[
          { label: 'MRR (est., plan rows)', value: `$${mrr.toLocaleString()}` },
          { label: 'Paid subscribers', value: paid },
          { label: 'Free → paid', value: `${conversion}%` },
          { label: 'Signups today', value: signupsToday ?? 0 },
          { label: 'Signups, 7 days', value: signupsWeek ?? 0 },
          { label: 'Users', value: userCount ?? 0 },
        ].map((m) => (
          <div key={m.label} className="card card--dense">
            <p className="font-mono-label">{m.label}</p>
            <p className="font-serif-metric">{m.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3" style={{ gap: 'var(--space-md)' }}>
        {[
          { label: 'Adapter runs pending review', value: pendingAdapters ?? 0 },
          { label: 'Resubmissions queued', value: queuedResubs ?? 0 },
        ].map((m) => (
          <div key={m.label} className="card card--dense">
            <p className="font-mono-label">{m.label}</p>
            <p className="font-serif-metric">{m.value}</p>
          </div>
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
