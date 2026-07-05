import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { updateProfile } from './actions'

export default async function SettingsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, email, plan')
    .eq('id', user!.id)
    .single()

  const plan = profile?.plan ?? 'free'

  return (
    <div className="flex flex-col" style={{ gap: 'var(--space-lg)', maxWidth: 640 }}>
      <header className="flex flex-col" style={{ gap: 'var(--space-xs)' }}>
        <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: '2rem' }}>Settings</h1>
        <p className="font-sans-body">Your profile, account, plan, and session.</p>
      </header>

      {/* Profile */}
      <section className="card flex flex-col" style={{ gap: 'var(--space-md)' }}>
        <h2 className="font-mono-label">Profile</h2>
        <form action={updateProfile} className="flex flex-col" style={{ gap: 'var(--space-md)' }}>
          <div className="flex flex-col" style={{ gap: 'var(--space-xs)' }}>
            <label className="font-mono-label" htmlFor="full_name">
              Full name
            </label>
            <input
              id="full_name"
              name="full_name"
              className="input-field"
              type="text"
              autoComplete="name"
              placeholder="Ada Lovelace"
              maxLength={120}
              defaultValue={profile?.full_name ?? ''}
            />
          </div>
          <div>
            <button className="btn-primary" type="submit">
              Save changes
            </button>
          </div>
        </form>
      </section>

      {/* Account */}
      <section className="card flex flex-col" style={{ gap: 'var(--space-sm)' }}>
        <h2 className="font-mono-label">Account</h2>
        <p className="font-mono-data">{profile?.email ?? user!.email}</p>
        <p className="font-mono-micro">
          Sign-in is passwordless — magic links go to this address. To change it, contact support.
        </p>
      </section>

      {/* Plan & billing */}
      <section className="card flex flex-col" style={{ gap: 'var(--space-sm)' }}>
        <h2 className="font-mono-label">Plan &amp; billing</h2>
        <div className="flex items-center" style={{ gap: 'var(--space-sm)' }}>
          <span className="font-mono-data" style={{ color: 'var(--paper)', textTransform: 'capitalize' }}>
            {plan}
          </span>
          {plan !== 'free' && <span className="status-live">active</span>}
        </div>
        <Link
          href="/pricing"
          className="font-mono-micro"
          style={{ color: 'var(--primary)', textDecoration: 'none' }}
        >
          {plan === 'free' ? 'Upgrade your plan →' : 'Manage plan →'}
        </Link>
      </section>

      {/* Support */}
      <section className="card flex flex-col" style={{ gap: 'var(--space-sm)' }}>
        <h2 className="font-mono-label">Support</h2>
        <p className="font-sans-body">Stuck, found a bug, or need help with billing? We answer fast.</p>
        <Link
          href="/support"
          className="font-mono-micro"
          style={{ color: 'var(--primary)', textDecoration: 'none' }}
        >
          Contact support →
        </Link>
      </section>

      {/* Session */}
      <section className="card flex flex-col" style={{ gap: 'var(--space-sm)' }}>
        <h2 className="font-mono-label">Session</h2>
        <p className="font-sans-body">
          Sign out of this device. Your products, listings, and scores stay exactly where they are.
        </p>
        <form action="/auth/signout" method="post">
          <button className="btn-ghost" type="submit">
            Sign out
          </button>
        </form>
      </section>
    </div>
  )
}
