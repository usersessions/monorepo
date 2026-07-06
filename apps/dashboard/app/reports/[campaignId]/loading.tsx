export default function Loading() {
  return (
    <div
      className="animate-pulse"
      style={{ maxWidth: 720, margin: '0 auto', padding: 'var(--space-2xl) var(--space-lg)', display: 'flex', flexDirection: 'column', gap: 'var(--space-lg)' }}
    >
      <div style={{ height: 28, width: 240, background: 'var(--ink-2)', borderRadius: 'var(--rounded-sm)' }} />
      {[0, 1, 2].map((i) => (
        <div key={i} className="card" style={{ height: 120 }} />
      ))}
    </div>
  )
}
