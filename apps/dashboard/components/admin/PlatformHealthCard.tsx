import Link from 'next/link'

const DOT: Record<string, string> = {
  healthy: 'var(--green, #22c55e)',
  degraded: 'var(--amber)',
  down: 'var(--red)',
  maintenance: 'var(--muted)',
}

export type PlatformHealthRow = {
  platformId: string
  name: string
  status: string
  lastCheckAt: string | null
  avgResponseMs: number | null
  errorRate: number | null
  adapterVersion: string | null
  liveSubmissions: number
}

function rel(iso: string | null): string {
  if (!iso) return 'never'
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (s < 60) return 'just now'
  if (s < 3600) return `${Math.floor(s / 60)} min ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  return `${Math.floor(s / 86400)}d ago`
}

// One platform tile: status dot, name, freshness, response/error/version, live count.
export default function PlatformHealthCard({ row }: { row: PlatformHealthRow }) {
  return (
    <Link href={`/admin/adapters?platform=${row.platformId}`} className="card card--dense" style={{ textDecoration: 'none', display: 'block' }}>
      <div className="flex" style={{ alignItems: 'center', gap: 'var(--space-sm)' }}>
        <span aria-hidden="true" style={{ width: 8, height: 8, borderRadius: '50%', background: DOT[row.status] ?? 'var(--muted)', display: 'inline-block', flexShrink: 0 }} />
        <p className="font-sans-label" style={{ fontWeight: 600 }}>{row.name}</p>
      </div>
      <p className="font-mono-micro">checked {rel(row.lastCheckAt)}</p>
      <p className="font-mono-micro">
        {row.avgResponseMs != null ? `${row.avgResponseMs}ms` : '—'} · err {row.errorRate != null ? `${Number(row.errorRate).toFixed(1)}%` : '—'} · {row.adapterVersion ?? '—'}
      </p>
      <p className="font-mono-micro">live: {row.liveSubmissions}</p>
    </Link>
  )
}
