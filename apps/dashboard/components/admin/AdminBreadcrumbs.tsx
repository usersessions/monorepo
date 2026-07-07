'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

// "Admin / Users / <id>" trail on deep admin pages; hidden on /admin itself.
export default function AdminBreadcrumbs() {
  const pathname = usePathname()
  if (!pathname.startsWith('/admin') || pathname === '/admin') return null

  const segments = pathname.split('/').filter(Boolean).slice(1)
  let acc = '/admin'

  return (
    <nav className="font-mono-micro" aria-label="Breadcrumb" style={{ color: 'var(--muted)', marginBottom: 'var(--space-md)' }}>
      <Link href="/admin" style={{ color: 'var(--muted)' }}>Admin</Link>
      {segments.map((seg) => {
        acc += `/${seg}`
        return (
          <span key={acc}>
            {' / '}
            <Link href={acc} style={{ color: 'var(--muted)' }}>{decodeURIComponent(seg)}</Link>
          </span>
        )
      })}
    </nav>
  )
}
