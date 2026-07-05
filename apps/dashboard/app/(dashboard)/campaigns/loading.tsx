export default function Loading() {
  return (
    <div className="flex flex-col animate-pulse" style={{ gap: 'var(--space-lg)' }}>
      <div style={{ height: 28, width: 160, background: 'var(--ink-2)', borderRadius: 'var(--rounded-sm)' }} />
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="card" style={{ height: 80 }} />
      ))}
    </div>
  )
}
