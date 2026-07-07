'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { ADMIN_NAV } from '@/lib/admin-nav'
import AdminSearch from './AdminSearch'
import MobileNav from './MobileNav'

/**
 * Responsive admin chrome: static sidebar on md+, hamburger drawer + fixed top
 * bar + bottom nav below 768px. Auth stays server-side in the layout — this
 * component only handles presentation.
 */
export default function AdminShell({ email, children }: { email: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()

  // Close the drawer whenever navigation happens.
  useEffect(() => {
    setOpen(false)
  }, [pathname])

  return (
    <div className="flex min-h-screen">
      {/* Mobile top bar */}
      <header
        className="md:hidden"
        style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 40, display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--ink-2)', borderBottom: '1px solid var(--border)', padding: 'var(--space-sm) var(--space-md)' }}
      >
        <span className="italic" style={{ fontFamily: 'var(--font-serif)', fontSize: '1.1rem' }}>usersessions</span>
        <span className="font-mono-label" style={{ color: 'var(--amber)' }}>Admin</span>
        <button className="btn-ghost" type="button" aria-label="Toggle menu" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
          ☰
        </button>
      </header>

      {/* Sidebar: static on md+, slide-over drawer on mobile */}
      <aside
        className={`${open ? 'flex' : 'hidden'} md:flex flex-col shrink-0`}
        style={{
          width: 224,
          background: 'var(--ink-2)',
          borderRight: '1px solid var(--border)',
          padding: 'var(--space-lg) var(--space-md)',
          gap: 'var(--space-lg)',
          ...(open ? { position: 'fixed', top: 49, bottom: 0, left: 0, zIndex: 30, overflowY: 'auto' } : {}),
        }}
      >
        <span className="italic hidden md:block" style={{ fontFamily: 'var(--font-serif)', fontSize: '1.25rem' }}>usersessions</span>
        <span className="font-mono-label hidden md:block" style={{ color: 'var(--amber)' }}>Admin Mode</span>

        <AdminSearch />

        <nav className="flex flex-col" style={{ gap: 'var(--space-xs)' }}>
          {ADMIN_NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="font-sans-label"
              aria-current={pathname === item.href ? 'page' : undefined}
              style={{ color: pathname === item.href ? 'var(--amber)' : 'var(--paper)', padding: 'var(--space-sm) var(--space-md)', textDecoration: 'none' }}
            >
              {item.label}
            </Link>
          ))}
          <Link href="/" className="font-sans-label" style={{ color: 'var(--muted)', padding: 'var(--space-sm) var(--space-md)', textDecoration: 'none' }}>
            ← Back to dashboard
          </Link>
        </nav>

        <p className="font-mono-micro" style={{ marginTop: 'auto' }}>{email}</p>
      </aside>

      <main className="flex-1" style={{ padding: 'var(--space-xl)' }}>
        <div className="mt-12 md:mt-0">
          <div style={{ maxWidth: 1280, margin: '0 auto', paddingBottom: 72 }}>{children}</div>
        </div>
      </main>

      <MobileNav />
    </div>
  )
}
