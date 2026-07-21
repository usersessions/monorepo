import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { limitsFor } from '@/lib/tiers'
import { NotificationToaster } from '@/components/NotificationToaster'
import { SidebarNav } from '@/components/SidebarNav'
import { onboardingLabel } from '@/lib/onboarding'
import { AvatarMenu } from '@/components/AvatarMenu'
import { CommandPalette } from '@/components/CommandPalette'
import { KeyboardShortcuts } from '@/components/KeyboardShortcuts'
import { ProductSwitcher } from '@/components/ProductSwitcher'
import { Breadcrumbs } from '@/components/Breadcrumbs'
import { HelpWidget } from '@/components/HelpWidget'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [
    { data: profile },
    { count: productCount },
    { count: campaignCount },
    { count: liveCount },
    { data: products },
    { count: unreadCount },
  ] = await Promise.all([
    supabase.from('profiles').select('role, plan, full_name, email').eq('id', user.id).single(),
    supabase.from('products').select('*', { count: 'exact', head: true }),
    supabase.from('campaigns').select('*', { count: 'exact', head: true }),
    supabase
      .from('submissions')
      .select('*', { count: 'exact', head: true })
      .in('status', ['live', 'indexed']),
    supabase.from('products').select('id, name').order('name').limit(20),
    supabase.from('notifications').select('*', { count: 'exact', head: true }).eq('read', false),
  ])

  const onboardingFlags = [
    (productCount ?? 0) > 0, // product added
    (liveCount ?? 0) > 0, // first video generated
  ]
  const onboarding = { done: onboardingFlags.filter(Boolean).length, total: onboardingFlags.length }

  const displayName = profile?.full_name ?? profile?.email ?? user.email ?? ''
  const email = profile?.email ?? user.email ?? ''
  const initial = displayName.trim().charAt(0).toUpperCase() || '·'
  const productSlots = limitsFor(profile?.plan).productSlots

  return (
    <div className="flex flex-col md:flex-row min-h-screen">
      <a href="#main" className="skip-link">Skip to main content</a>
      <NotificationToaster userId={user.id} />
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
            [onboardingLabel(onboarding), '/onboarding'],
            ['Overview', '/'],
            ['Generate', '/generate'],
            ['Videos', '/videos'],
            ['Products', '/products'],
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

        <ProductSwitcher products={products ?? []} slotsTotal={productSlots} />

        <SidebarNav
          isAdmin={profile?.role === 'admin'}
          onboarding={onboarding}
          unreadCount={unreadCount ?? 0}
        />

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

      <main id="main" className="flex-1" style={{ padding: 'var(--space-xl)' }}>
        <div style={{ maxWidth: 1280, margin: '0 auto' }}>
          <Breadcrumbs />
          {children}
        </div>
      </main>

      <HelpWidget />
    </div>
  )
}
