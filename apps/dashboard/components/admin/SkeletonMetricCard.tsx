// Pulse skeleton matching the dimensions of a dense metric card (label + number + subtext).
export default function SkeletonMetricCard() {
  return (
    <div className="card card--dense animate-pulse" aria-hidden="true">
      <div style={{ height: 12, width: 120, background: 'var(--ink-2)', borderRadius: 'var(--rounded-sm)', marginBottom: 'var(--space-sm)' }} />
      <div style={{ height: 32, width: 96, background: 'var(--ink-2)', borderRadius: 'var(--rounded-sm)', marginBottom: 'var(--space-sm)' }} />
      <div style={{ height: 10, width: 72, background: 'var(--ink-2)', borderRadius: 'var(--rounded-sm)' }} />
    </div>
  )
}
