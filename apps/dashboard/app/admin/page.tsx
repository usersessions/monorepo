import { requireAdmin } from '@/lib/admin'
import { createServiceClient } from '@/lib/supabase/server'

export default async function AdminSystemPage() {
  await requireAdmin()
  const db = createServiceClient()

  const [{ data: cronLogs }, { count: pendingAdapters }, { count: queuedResubs }, { count: userCount }] =
    await Promise.all([
      db.from('cron_logs').select('job_name, status, detail, ran_at').order('ran_at', { ascending: false }).limit(20),
      db.from('adapter_runs').select('*', { count: 'exact', head: true }).eq('status', 'pending_review'),
      db.from('resubmission_queue').select('*', { count: 'exact', head: true }).eq('status', 'queued'),
      db.from('profiles').select('*', { count: 'exact', head: true }),
    ])

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
          { label: 'Users', value: userCount ?? 0 },
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
