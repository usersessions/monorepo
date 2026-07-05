import Link from 'next/link'

const LINKS = [
  { label: 'Pricing', href: '/pricing' },
  { label: 'Support', href: '/support' },
  { label: 'Terms', href: '/terms' },
  { label: 'Privacy', href: '/privacy' },
  { label: 'Sign in', href: '/login' },
]

/** Shared marketing footer — the trust layer belongs on every public page. */
export function MarketingFooter() {
  return (
    <footer
      className="flex flex-col items-center"
      style={{
        gap: 'var(--space-sm)',
        padding: 'var(--space-xl) var(--space-lg)',
        borderTop: '1px solid var(--border)',
        marginTop: 'var(--space-2xl)',
      }}
    >
      <nav className="flex flex-wrap justify-center" style={{ gap: 'var(--space-lg)' }}>
        {LINKS.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className="font-mono-micro"
            style={{ color: 'var(--muted)', textDecoration: 'none' }}
          >
            {l.label}
          </Link>
        ))}
      </nav>
      <p className="font-mono-micro">© {new Date().getFullYear()} usersessions · Get your product found</p>
    </footer>
  )
}
