import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ExtensionBridge } from '@/components/ExtensionBridge'
import { RealtimeRefresh } from '@/components/RealtimeRefresh'
import { SidebarNav } from '@/components/SidebarNav'
import { AvatarMenu } from '@/components/AvatarMenu'
import { CommandPalette } from '@/components/CommandPalette'
import { KeyboardShortcuts } from '@/components/KeyboardShortcuts'

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

  const displayName = profile?.full_name ?? profile?.email ?? user.email ?? ''
  const email = profile?.email ?? user.email ?? ''
  const initial = displayName.trim().charAt(0).toUpperCase() || '·'

  return (
    <div className="flex flex-col md:flex-row min-h-screen">
      <ExtensionBridge />
      <RealtimeRefresh userId={user.id} />
      <CommandPalette />
      <KeyboardShortcuts />

      {/* Mobile top bar — the fixed sidebar is hidden below md */}
      <header
        className="md:hidden"
        style={{ background: 'var(--ink-2)', borderBottom: '1px solid var(--border)', padding: 'var(--space-sm) var(--space-md)' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Link
            href="/"
            className="italic"
            style={{ fontFamily: 'var(--font-serif)', fontSize: '1.1rem', color: 'var(--paper)', textDecoration: 'none' }}
          >
            usersessions
          </Link>
          <span className="font-mono-micro">{profile?.plan ?? 'free'}</span>
        </div>
        <nav aria-label="Primary" style={{ display: 'flex', gap: 'var(--space-md)', overflowX: 'auto', paddingTop: 'var(--space-sm)' }}>
          {[
            ['Overview', '/'],
            ['Campaigns', '/campaigns'],
            ['Listings', '/listings'],
            ['Platforms', '/platforms'],
            ['Analytics', '/analytics'],
            ['Competitors', '/competitors'],
            ['Notifications', '/notifications'],
            ['Settings', '/settings'],
          ].map(([label, href]) => (
            <Link key={href} href={href} className="font-mono-label" style={{ color: 'var(--paper)', textDecoration: 'none', whiteSpace: 'nowrap' }}>
              {label}
            </Link>
          ))}
          {profile?.role === 'admin' && (
            <Link href="/admin" className="font-mono-label" style={{ color: 'var(--amber)', textDecoration: 'none', whiteSpace: 'nowrap' }}>
              Admin
            </Link>
          )}
        </nav>
      </header>

      <aside
        className="hidden md:flex flex-col shrink-0"
        style={{
          width: 240,
          background: 'var(--ink-2)',
          borderRight: '1px solid var(--border)',
          padding: 'var(--space-lg) var(--space-md)',
          gap: 'var(--space-lg)',
        }}
      >
        <Link
          href="/"
          className="italic"
          style={{ fontFamily: 'var(--font-serif)', fontSize: '1.25rem', color: 'var(--paper)', textDecoration: 'none' }}
        >
          usersessions
        </Link>

        <SidebarNav isAdmin={profile?.role === 'admin'} />

        <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 'var(--space-xs)' }}>
          <p className="font-mono-micro" style={{ paddingLeft: 'var(--space-xs)', opacity: 0.4 }}>
            ⌘K to jump anywhere
          </p>
          <AvatarMenu
            displayName={displayName}
            email={email}
            plan={profile?.plan ?? 'free'}
            initial={initial}
          />
        </div>
      </aside>

      <main className="flex-1" style={{ padding: 'var(--space-xl)' }}>
        <div style={{ maxWidth: 1280, margin: '0 auto' }}>{children}</div>
      </main>
    </div>
  )
}
