export default function Loading() {
  return (
    <div className="flex flex-col" style={{ gap: 'var(--space-lg)', maxWidth: 760 }}>
      <div className="card" style={{ height: 96, opacity: 0.5 }} />
      <div className="card" style={{ height: 280, opacity: 0.35 }} />
    </div>
  )
}
