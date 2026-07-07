import { CRON_JOBS } from '@/lib/cron-jobs'
import { nextRun } from '@/lib/cron-jobs'
import { createServiceClient } from '@/lib/supabase/server'
import RunCronButton from '../RunCronButton'

type CronLog = { job_name: string; status: string; detail: unknown; ran_at: string }

function statusFor(log?: CronLog): { cls: string; label: string } {
  if (!log) return { cls: 'font-mono-micro', label: '—' }
  if (log.status !== 'ok') return { cls: 'status-dead', label: 'failed' }
  const age = Date.now() - new Date(log.ran_at).getTime()
  if (age < 3600e3) return { cls: 'status-live', label: 'ok' }
  if (age < 24 * 3600e3) return { cls: 'status-pending', label: 'stale' }
  return { cls: 'status-dead', label: 'overdue' }
}

const fmt = (iso: string) => new Date(iso).toISOString().replace('T', ' ').slice(0, 16)

// Full cron table — every registered job is visible even with zero runs (Cron Gate).
export default async function CronSection() {
  const db = createServiceClient()
  const { data: logs } = await db
    .from('cron_logs')
    .select('job_name, status, detail, ran_at')
    .order('ran_at', { ascending: false })
    .limit(100)

  const latest = new Map<string, CronLog>()
  for (const log of (logs ?? []) as CronLog[]) {
    if (!latest.has(log.job_name)) latest.set(log.job_name, log)
  }

  return (
    <div className="card card--dense" style={{ overflowX: 'auto' }}>
      <p className="font-mono-label" style={{ marginBottom: 'var(--space-md)' }}>Cron jobs</p>
      <div className="flex font-mono-micro" style={{ gap: 'var(--space-md)', padding: 'var(--space-sm) 0', color: 'var(--muted)', minWidth: 760 }}>
        <span style={{ flex: 1, minWidth: 130 }}>Job</span>
        <span style={{ width: 90 }}>Schedule</span>
        <span style={{ width: 130 }}>Last run (UTC)</span>
        <span style={{ width: 70 }}>Status</span>
        <span style={{ width: 80 }}>Duration</span>
        <span style={{ width: 130 }}>Next run (UTC)</span>
        <span style={{ width: 100 }}>Actions</span>
      </div>
      {CRON_JOBS.map((job) => {
        const log = latest.get(job.name)
        const s = statusFor(log)
        const next = nextRun(job.schedule)
        const durationMs = (log?.detail as { duration_ms?: number } | null | undefined)?.duration_ms
        return (
          <div key={job.name} className="flex" style={{ gap: 'var(--space-md)', borderTop: '1px solid var(--border)', padding: 'var(--space-sm) 0', alignItems: 'center', minWidth: 760 }}>
            <span className="font-mono-data" style={{ flex: 1, minWidth: 130 }} title={job.description}>{job.name}</span>
            <span className="font-mono-micro" style={{ width: 90 }}>{job.schedule}</span>
            <span className="font-mono-micro" style={{ width: 130 }}>{log ? fmt(log.ran_at) : 'Never'}</span>
            <span className={s.cls} style={{ width: 70 }}>{s.label}</span>
            <span className="font-mono-micro" style={{ width: 80 }}>{durationMs ? `${durationMs}ms` : '—'}</span>
            <span className="font-mono-micro" style={{ width: 130 }}>{next ? fmt(next.toISOString()) : '—'}</span>
            <span style={{ width: 100 }}>
              <RunCronButton job={job.name} />
            </span>
          </div>
        )
      })}
    </div>
  )
}
