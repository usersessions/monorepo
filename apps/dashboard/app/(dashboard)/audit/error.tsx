'use client'

export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="card flex flex-col" style={{ gap: 'var(--space-sm)', maxWidth: 760 }}>
      <p className="font-mono-label" style={{ color: 'var(--red)' }}>The audit view could not load</p>
      <p className="font-sans-body">That was us, not you. Your data is safe.</p>
      <button className="btn-primary" type="button" onClick={() => reset()} style={{ width: 'fit-content' }}>
        Try again
      </button>
    </div>
  )
}
