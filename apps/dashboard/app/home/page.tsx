import Link from 'next/link'

/**
 * Marketing placeholder. The full StoryBrand homepage is M13 and launches only after
 * real data exists (BUILD_SPEC §13). Until then: honest one-liner + the one CTA, verbatim.
 */
export default function HomePage() {
  return (
    <main
      className="min-h-screen flex flex-col items-center justify-center text-center"
      style={{ gap: 'var(--space-lg)', padding: 'var(--space-2xl)' }}
    >
      <span className="italic" style={{ fontFamily: 'var(--font-serif)', fontSize: '2rem' }}>
        usersessions
      </span>
      <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: '2.5rem', maxWidth: 640, lineHeight: 1.15 }}>
        You shipped it in a weekend. You have zero users.
      </h1>
      <p className="font-sans-body" style={{ maxWidth: 520 }}>
        Building was never the hard part. usersessions lists your product everywhere AI assistants
        and humans discover software, verifies every listing, and tracks whether AI actually
        recommends you.
      </p>
      <Link href="/login" className="btn-primary" style={{ textDecoration: 'none' }}>
        Get your product found
      </Link>
    </main>
  )
}
