// Pulse skeleton reserving the exact height of a chart card to avoid layout shift.
export default function SkeletonChart({ height = 240 }: { height?: number }) {
  return (
    <div className="card card--dense animate-pulse" aria-hidden="true">
      <div style={{ height: 12, width: 140, background: 'var(--ink-2)', borderRadius: 'var(--rounded-sm)', marginBottom: 'var(--space-md)' }} />
      <div style={{ height, background: 'var(--ink-2)', borderRadius: 'var(--rounded-sm)' }} />
    </div>
  )
}
