import Link from 'next/link'
import { MarketingFooter } from '@/components/MarketingFooter'

const PLAN = [
  {
    step: '1. Install',
    copy: 'Add the extension. It works in your own browser, your own session, your own accounts.',
  },
  {
    step: '2. Launch',
    copy: 'Approve every word of your listing copy, then we submit to the platforms that matter.',
  },
  {
    step: '3. Watch',
    copy: 'See where you are live, and whether AI assistants actually recommend you.',
  },
]

export default function HomePage() {
  return (
    <>
      <main
        className="min-h-screen flex flex-col items-center justify-center text-center"
        style={{ gap: 'var(--space-xl)', padding: 'var(--space-2xl) var(--space-lg)' }}
      >
        <span className="italic" style={{ fontFamily: 'var(--font-serif)', fontSize: '2rem' }}>
          usersessions
        </span>

        <div className="flex flex-col items-center" style={{ gap: 'var(--space-md)' }}>
          <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: '2.5rem', maxWidth: 640, lineHeight: 1.15 }}>
            You shipped it in a weekend. You have zero users.
          </h1>
          <p className="font-sans-body" style={{ maxWidth: 520 }}>
            Building was never the hard part. usersessions lists your product everywhere AI assistants
            and humans discover software, verifies every listing, and tracks whether AI actually
            recommends you.
          </p>
        </div>

        <div className="flex flex-col items-center" style={{ gap: 'var(--space-sm)' }}>
          <Link href="/signup" className="btn-primary" style={{ textDecoration: 'none' }}>
            Get your product found
          </Link>
          <Link href="/pricing" className="font-mono-micro" style={{ color: 'var(--muted)', textDecoration: 'none' }}>
            See pricing →
          </Link>
        </div>

        <div
          className="grid grid-cols-1 md:grid-cols-3 w-full"
          style={{ gap: 'var(--space-md)', maxWidth: 880, marginTop: 'var(--space-lg)' }}
        >
          {PLAN.map((p) => (
            <div key={p.step} className="card card--dense text-left">
              <p className="font-mono-label" style={{ marginBottom: 'var(--space-xs)' }}>
                {p.step}
              </p>
              <p className="font-sans-body">{p.copy}</p>
            </div>
          ))}
        </div>
      </main>
      <MarketingFooter />
    </>
  )
}
