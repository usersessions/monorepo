export default function Loading() {
  return (
    <div className="flex flex-col animate-pulse" style={{ gap: 'var(--space-lg)' }}>
      <div style={{ height: 28, width: 120, background: 'var(--ink-2)', borderRadius: 'var(--rounded-sm)' }} />
      <div className="card card--dense" style={{ height: 56 }} />
      <div className="card card--dense" style={{ height: 320 }} />
    </div>
  )
}
