export default function Loading() {
  return (
    <div className="flex flex-col animate-pulse" style={{ gap: 'var(--space-xl)' }}>
      <div style={{ height: 36, width: 160, background: 'var(--ink-2)', borderRadius: 'var(--rounded-sm)' }} />
      {['ai', 'startup'].map((cat) => (
        <div key={cat} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
          <div style={{ height: 16, width: 180, background: 'var(--ink-2)', borderRadius: 'var(--rounded-sm)' }} />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3" style={{ gap: 'var(--space-md)' }}>
            {[0, 1, 2].map((i) => (
              <div key={i} className="card card--dense" style={{ height: 100 }} />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
