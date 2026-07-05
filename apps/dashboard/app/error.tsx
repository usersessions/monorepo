'use client'

/** Global error boundary — a paid product never shows a blank screen or a stack trace. */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <main
      className="min-h-screen flex flex-col items-center justify-center text-center"
      style={{ gap: 'var(--space-md)', padding: 'var(--space-2xl)' }}
    >
      <p className="font-mono-label" style={{ color: 'var(--red)' }}>
        Something went wrong
      </p>
      <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: '2rem' }}>
        That was us, not you.
      </h1>
      <p className="font-sans-body" style={{ maxWidth: 420 }}>
        The error has been contained and none of your data was affected. Try again — if it keeps
        happening, tell support and include the reference below.
      </p>
      {error.digest && <p className="font-mono-micro">ref: {error.digest}</p>}
      <button className="btn-primary" type="button" onClick={() => reset()}>
        Try again
      </button>
      <a href="/support" className="font-mono-micro" style={{ color: 'var(--muted)' }}>
        Contact support
      </a>
    </main>
  )
}
