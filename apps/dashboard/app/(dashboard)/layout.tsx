import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ExtensionBridge } from '@/components/ExtensionBridge'

const NAV: { label: string; href: string }[] = [
  { label: 'Overview', href: '/' },
  { label: 'Campaigns', href: '/campaigns' },
  { label: 'Listings', href: '/listings' },
  { label: 'Platforms', href: '/platforms' },
  { label: 'Analytics', href: '/analytics' },
]

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, plan, full_name, email')
    .eq('id', user.id)
    .single()

  return (
    <div className="flex min-h-screen">
      <ExtensionBridge />

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

        <nav className="flex flex-col" style={{ gap: 'var(--space-xs)' }}>
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="font-sans-label"
              style={{
                color: 'var(--paper)',
                borderRadius: 'var(--rounded-sm)',
                padding: 'var(--space-sm) var(--space-md)',
                textDecoration: 'none',
              }}
            >
              {item.label}
            </Link>
          ))}
          {profile?.role === 'admin' && (
            <span
              className="font-sans-label"
              title="Lands in M12"
              style={{ color: 'var(--muted-2)', padding: 'var(--space-sm) var(--space-md)' }}
            >
              Admin
            </span>
          )}
        </nav>

        <div style={{ marginTop: 'auto' }}>
          <p className="font-mono-micro">{profile?.email ?? user.email}</p>
          <p className="font-mono-micro" style={{ color: 'var(--muted)' }}>
            plan: {profile?.plan ?? 'free'}
          </p>
        </div>
      </aside>

      <main className="flex-1" style={{ padding: 'var(--space-xl)' }}>
        <div style={{ maxWidth: 1280, margin: '0 auto' }}>{children}</div>
      </main>
    </div>
  )
}
