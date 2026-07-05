import Link from 'next/link'

export default function NotFound() {
  return (
    <main
      className="min-h-screen flex flex-col items-center justify-center text-center"
      style={{ gap: 'var(--space-md)', padding: 'var(--space-2xl)' }}
    >
      <p className="font-mono-label">404</p>
      <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: '2rem' }}>This page does not exist.</h1>
      <p className="font-sans-body" style={{ maxWidth: 420 }}>
        The link may be old, or the page may have moved. Your data is still exactly where you left
        it.
      </p>
      <Link href="/" className="btn-primary" style={{ textDecoration: 'none' }}>
        Back to dashboard
      </Link>
      <Link href="/support" className="font-mono-micro" style={{ color: 'var(--muted)' }}>
        Contact support
      </Link>
    </main>
  )
}
