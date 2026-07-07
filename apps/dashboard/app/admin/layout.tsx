import Link from 'next/link'
import { requireAdmin } from '@/lib/admin'
import AdminSearch from '@/components/admin/AdminSearch'

const NAV = [
  { label: 'System', href: '/admin' },
  { label: 'Users', href: '/admin/users' },
  { label: 'Billing', href: '/admin/billing' },
  { label: 'Support', href: '/admin/support' },
  { label: 'Adapters', href: '/admin/adapters' },
  { label: 'Data quality', href: '/admin/data-quality' },
  { label: 'Flags', href: '/admin/flags' },
  { label: 'Compliance', href: '/admin/compliance' },
  { label: 'Audit log', href: '/admin/audit' },
  { label: 'Settings', href: '/admin/settings' },
  { label: 'Dogfood campaign', href: '/admin/dogfood' },
]

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { email } = await requireAdmin() // hard redirect for non-admins, every route

  return (
    <div className="flex min-h-screen">
      <aside
        className="flex flex-col shrink-0"
        style={{
          width: 224,
          background: 'var(--ink-2)',
          borderRight: '1px solid var(--border)',
          padding: 'var(--space-lg) var(--space-md)',
          gap: 'var(--space-lg)',
        }}
      >
        <span className="italic" style={{ fontFamily: 'var(--font-serif)', fontSize: '1.25rem' }}>
          usersessions
        </span>
        <span className="font-mono-label" style={{ color: 'var(--amber)' }}>Admin Mode</span>

        <AdminSearch />

        <nav className="flex flex-col" style={{ gap: 'var(--space-xs)' }}>
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="font-sans-label"
              style={{ color: 'var(--paper)', padding: 'var(--space-sm) var(--space-md)', textDecoration: 'none' }}
            >
              {item.label}
            </Link>
          ))}
          <Link
            href="/"
            className="font-sans-label"
            style={{ color: 'var(--muted)', padding: 'var(--space-sm) var(--space-md)', textDecoration: 'none' }}
          >
            ← Back to dashboard
          </Link>
        </nav>

        <p className="font-mono-micro" style={{ marginTop: 'auto' }}>{email}</p>
      </aside>

      <main className="flex-1" style={{ padding: 'var(--space-xl)' }}>
        <div style={{ maxWidth: 1280, margin: '0 auto' }}>{children}</div>
      </main>
    </div>
  )
}
