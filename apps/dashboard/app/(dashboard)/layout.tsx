import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ExtensionBridge } from '@/components/ExtensionBridge'
import { RealtimeRefresh } from '@/components/RealtimeRefresh'
import { SidebarNav } from '@/components/SidebarNav'
import { AvatarMenu } from '@/components/AvatarMenu'
import { CommandPalette } from '@/components/CommandPalette'

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
    <div className="flex min-h-screen">
      <ExtensionBridge />
      <RealtimeRefresh userId={user.id} />
      <CommandPalette />

      <aside
        className="flex flex-col shrink-0"
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
