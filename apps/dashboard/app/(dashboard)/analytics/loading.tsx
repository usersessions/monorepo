export default function Loading() {
  return (
    <div className="flex flex-col animate-pulse" style={{ gap: 'var(--space-lg)' }}>
      <div style={{ height: 28, width: 140, background: 'var(--ink-2)', borderRadius: 'var(--rounded-sm)' }} />
      <div className="card" style={{ height: 240 }} />
      <div className="grid grid-cols-1 md:grid-cols-2" style={{ gap: 'var(--space-lg)' }}>
        <div className="card card--dense" style={{ height: 120 }} />
        <div className="card card--dense" style={{ height: 120 }} />
      </div>
      <div className="card card--dense" style={{ height: 200 }} />
    </div>
  )
}
