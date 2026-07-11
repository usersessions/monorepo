'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { onboardingLabel, type OnboardingProgress } from '@/lib/onboarding'

const NAV: { label: string; href: string }[] = [
  { label: 'Get started', href: '/onboarding' },
  { label: 'Overview', href: '/' },
  { label: 'Campaigns', href: '/campaigns' },
  { label: 'Listings', href: '/listings' },
  { label: 'Platforms', href: '/platforms' },
  { label: 'Surfaces', href: '/surfaces' },
  { label: 'Reviews', href: '/reviews' },
  { label: 'AIO Audit', href: '/audit' },
  { label: 'Analytics', href: '/analytics' },
  { label: 'Competitors', href: '/competitors' },
  { label: 'Notifications', href: '/notifications' },
  { label: 'Settings', href: '/settings' },
]

export function SidebarNav({
  isAdmin,
  onboarding,
  unreadCount = 0,
}: {
  isAdmin: boolean
  onboarding?: OnboardingProgress
  unreadCount?: number
}) {
  const pathname = usePathname()
  const isActive = (href: string) => (href === '/' ? pathname === '/' : pathname.startsWith(href))
  const complete = onboarding ? onboarding.done >= onboarding.total : false

  return (
    <nav className="flex flex-col" style={{ gap: 'var(--space-xs)' }}>
      {NAV.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={`nav-link${isActive(item.href) ? ' nav-link--active' : ''}`}
          aria-current={isActive(item.href) ? 'page' : undefined}
          style={item.href === '/onboarding' && complete ? { color: 'var(--green)' } : undefined}
        >
          {item.href === '/onboarding' ? onboardingLabel(onboarding) : item.label}
          {item.href === '/notifications' && unreadCount > 0 && (
            <span
              aria-label={`${unreadCount} unread notifications`}
              className="font-mono-micro"
              style={{
                background: 'var(--primary, var(--amber))',
                color: 'var(--ink)',
                borderRadius: 999,
                padding: '0 6px',
                marginLeft: 6,
              }}
            >
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
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
