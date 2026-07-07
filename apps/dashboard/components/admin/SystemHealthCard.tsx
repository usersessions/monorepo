import type { HealthStatus } from '@/lib/monitoring'

const BADGE: Record<HealthStatus, string> = { live: 'ok', pending: 'warn', dead: 'down' }

// One system health card: label + status badge, big value, muted detail line.
export default function SystemHealthCard({ label, value, status, sub }: { label: string; value: string; status: HealthStatus; sub?: string }) {
  return (
    <div className="card card--dense">
      <div className="flex" style={{ justifyContent: 'space-between', alignItems: 'baseline', gap: 'var(--space-sm)' }}>
        <p className="font-mono-label">{label}</p>
        <span className={`status-${status}`}>{BADGE[status]}</span>
      </div>
      <p className="font-serif-metric">{value}</p>
      {sub ? <p className="font-mono-micro">{sub}</p> : null}
    </div>
  )
}
