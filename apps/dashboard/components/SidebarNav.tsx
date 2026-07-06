'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const NAV: { label: string; href: string }[] = [
  { label: 'Get started', href: '/onboarding' },
  { label: 'Overview', href: '/' },
  { label: 'Campaigns', href: '/campaigns' },
  { label: 'Listings', href: '/listings' },
  { label: 'Platforms', href: '/platforms' },
  { label: 'Analytics', href: '/analytics' },
  { label: 'Competitors', href: '/competitors' },
  { label: 'Notifications', href: '/notifications' },
  { label: 'Settings', href: '/settings' },
]

export function SidebarNav({ isAdmin }: { isAdmin: boolean }) {
  const pathname = usePathname()
  const isActive = (href: string) => (href === '/' ? pathname === '/' : pathname.startsWith(href))

  return (
    <nav className="flex flex-col" style={{ gap: 'var(--space-xs)' }}>
      {NAV.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={`nav-link${isActive(item.href) ? ' nav-link--active' : ''}`}
          aria-current={isActive(item.href) ? 'page' : undefined}
        >
          {item.label}
        </Link>
      ))}
      {isAdmin && (
        <Link
          href="/admin"
          className={`nav-link${pathname.startsWith('/admin') ? ' nav-link--active' : ''}`}
          style={{ color: 'var(--amber)' }}
        >
          Admin
        </Link>
      )}
    </nav>
  )
}
