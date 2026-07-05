import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ExtensionBridge } from '@/components/ExtensionBridge'
import { SidebarNav } from '@/components/SidebarNav'

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
  const initial = displayName.trim().charAt(0).toUpperCase() || '·'

  return (
    <div className="flex min-h-screen">
      <ExtensionBridge />

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

        <div className="flex flex-col" style={{ marginTop: 'auto', gap: 'var(--space-sm)' }}>
          <div className="flex items-center" style={{ gap: 'var(--space-sm)' }}>
            <span
              className="flex items-center justify-center shrink-0"
              style={{
                width: 32,
                height: 32,
                borderRadius: '50%',
                background: 'var(--primary-dim)',
                border: '1px solid var(--border)',
                fontFamily: 'var(--font-serif)',
                fontSize: '1rem',
              }}
            >
              {initial}
            </span>
            <div style={{ minWidth: 0 }}>
              <p className="font-mono-micro truncate" style={{ color: 'var(--paper)' }}>
                {profile?.email ?? user.email}
              </p>
              <p className="font-mono-micro">plan: {profile?.plan ?? 'free'}</p>
            </div>
          </div>
          <form action="/auth/signout" method="post">
            <button
              className="btn-ghost w-full"
              type="submit"
              style={{ padding: 'var(--space-xs) var(--space-md)', fontSize: '0.75rem' }}
            >
              Sign out
            </button>
          </form>
        </div>
      </aside>

      <main className="flex-1" style={{ padding: 'var(--space-xl)' }}>
        <div style={{ maxWidth: 1280, margin: '0 auto' }}>{children}</div>
      </main>
    </div>
  )
}
