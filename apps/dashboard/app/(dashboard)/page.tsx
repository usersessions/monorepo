import Link from 'next/link'

export const dynamic = 'force-dynamic'

/** Overview — video product pivot. TODO(pivot): wire real stats once the `videos` table lands. */
export default function OverviewPage() {
  const stats = [
    { label: 'Videos generated', value: '—' },
    { label: 'Videos ready', value: '—' },
    { label: 'Credits left', value: '—' },
  ]
  return (
    <div className="flex flex-col" style={{ gap: 'var(--space-lg)' }}>
      <header>
        <h1>Overview</h1>
        <p style={{ color: 'var(--muted)' }}>Turn any product page into a marketing video.</p>
      </header>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 'var(--space-md)' }}>
        {stats.map((s) => (
          <div key={s.label} className="card" style={{ padding: 'var(--space-md)' }}>
            <p className="font-mono-micro" style={{ color: 'var(--muted)' }}>{s.label}</p>
            <p style={{ fontSize: '2rem' }}>{s.value}</p>
          </div>
        ))}
      </div>
      <div>
        <Link href="/generate" className="nav-link">Generate your first video →</Link>
      </div>
    </div>
  )
}
