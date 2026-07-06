import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { updateProfile, saveNotificationPrefs } from './actions'
import { UsageMeter } from '@/components/UpgradePrompt'
import { limitsFor, monthStartIso } from '@/lib/tiers'

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; notif_saved?: string; cancelled?: string; cancel_error?: string }>
}) {
  const params = await searchParams
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, email, plan, notif_weekly_digest, notif_link_alerts, notif_new_platforms')
    .eq('id', user!.id)
    .single()

  const plan = profile?.plan ?? 'free'
  const limits = limitsFor(plan)

  const [{ count: productCount }, { count: launchesThisMonth }, { count: visibilityQueryCount }] =
    await Promise.all([
      supabase.from('products').select('*', { count: 'exact', head: true }),
      supabase
        .from('campaigns')
        .select('*', { count: 'exact', head: true })
        .eq('simulated', false)
        .gte('started_at', monthStartIso()),
      supabase.from('visibility_queries').select('*', { count: 'exact', head: true }),
    ])

  return (
    <div className="flex flex-col" style={{ gap: 'var(--space-lg)', maxWidth: 640 }}>
      <header className="flex flex-col" style={{ gap: 'var(--space-xs)' }}>
        <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: '2rem' }}>Settings</h1>
        <p className="font-sans-body">Your profile, account, plan, and session.</p>
      </header>

      {/* Save feedback */}
      {params.saved && (
        <div
          style={{
            border: '1px solid var(--green)',
            borderRadius: 'var(--rounded-sm)',
            padding: 'var(--space-sm) var(--space-md)',
            background: 'rgba(52,211,153,0.05)',
          }}
        >
          <p className="font-mono-label" style={{ color: 'var(--green)' }}>
            ✓ Profile saved
          </p>
        </div>
      )}
      {params.notif_saved && (
        <div
          style={{
            border: '1px solid var(--green)',
            borderRadius: 'var(--rounded-sm)',
            padding: 'var(--space-sm) var(--space-md)',
            background: 'rgba(52,211,153,0.05)',
          }}
        >
          <p className="font-mono-label" style={{ color: 'var(--green)' }}>
            ✓ Notification preferences saved
          </p>
        </div>
      )}

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

      {/* Plan & billing usage */}
      <section className="card flex flex-col" style={{ gap: 'var(--space-md)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)', justifyContent: 'space-between' }}>
          <h2 className="font-mono-label">Plan &amp; billing</h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
            <span className="font-mono-data" style={{ color: 'var(--paper)', textTransform: 'capitalize' }}>
              {plan}
            </span>
            {plan !== 'free' && <span className="status-live">active</span>}
          </div>
        </div>

        {/* Usage meters */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
          <UsageMeter label="Products" used={productCount ?? 0} total={limits.productSlots} />
          <UsageMeter
            label="Launches this month"
            used={launchesThisMonth ?? 0}
            total={limits.launchesPerProductPerMonth * Math.max(productCount ?? 1, 1)}
          />
          <UsageMeter
            label="Visibility queries tracked"
            used={visibilityQueryCount ?? 0}
            total={limits.visibilityQueriesPerProduct * Math.max(productCount ?? 1, 1)}
          />
        </div>

        <Link
          href="/pricing"
          className="font-mono-micro"
          style={{ color: 'var(--primary)', textDecoration: 'none' }}
        >
          {plan === 'free' ? 'Upgrade your plan →' : 'Manage plan →'}
        </Link>

        {params.cancelled && (
          <p className="font-mono-label" style={{ color: 'var(--green)' }}>
            ✓ Auto-renew is off — your plan stays active until the end of the billing period.
          </p>
        )}
        {params.cancel_error && (
          <p className="font-mono-label" style={{ color: 'var(--red)' }}>
            Could not cancel automatically. Contact support and we will do it immediately.
          </p>
        )}
        {plan !== 'free' && !params.cancelled && (
          <form action="/api/billing/cancel" method="post">
            <button className="btn-ghost" type="submit">Cancel subscription</button>
          </form>
        )}
      </section>

      {/* Integrations */}
      <section className="card flex flex-col" style={{ gap: 'var(--space-sm)' }}>
        <h2 className="font-mono-label">Integrations</h2>
        <p className="font-sans-body">Send dead-link alerts and campaign updates to Slack or Discord.</p>
        <Link
          href="/settings/integrations"
          className="font-mono-micro"
          style={{ color: 'var(--primary)', textDecoration: 'none' }}
        >
          Manage integrations →
        </Link>
      </section>

      {/* Notification preferences */}
      <section className="card flex flex-col" style={{ gap: 'var(--space-md)' }}>
        <h2 className="font-mono-label">Notifications</h2>
        <p className="font-sans-body">Choose which emails you receive from usersessions.</p>
        <form action={saveNotificationPrefs} className="flex flex-col" style={{ gap: 'var(--space-md)' }}>
          {[
            {
              id: 'notif_weekly_digest',
              label: 'Weekly digest',
              description: 'A summary of your distribution score, new listings, and any issues.',
              defaultChecked: profile?.notif_weekly_digest ?? true,
            },
            {
              id: 'notif_link_alerts',
              label: 'Dead link alerts',
              description: 'Email when a listing goes dead and after it is resubmitted.',
              defaultChecked: profile?.notif_link_alerts ?? true,
            },
            {
              id: 'notif_new_platforms',
              label: 'New platforms',
              description: 'When a new submission target is added to your network.',
              defaultChecked: profile?.notif_new_platforms ?? true,
            },
          ].map((pref) => (
            <label
              key={pref.id}
              style={{ display: 'flex', gap: 'var(--space-md)', alignItems: 'flex-start', cursor: 'pointer' }}
            >
              <input
                type="checkbox"
                name={pref.id}
                value="on"
                defaultChecked={pref.defaultChecked}
                style={{ marginTop: 3, accentColor: 'var(--primary)', width: 16, height: 16, flexShrink: 0 }}
              />
              <div>
                <p className="font-sans-label" style={{ color: 'var(--paper)' }}>
                  {pref.label}
                </p>
                <p className="font-mono-micro">{pref.description}</p>
              </div>
            </label>
          ))}
          <div>
            <button className="btn-ghost" type="submit">
              Save preferences
            </button>
          </div>
        </form>
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

      {/* Danger zone */}
      <section className="card flex flex-col" style={{ gap: 'var(--space-md)', borderColor: 'var(--red)' }}>
        <h2 className="font-mono-label" style={{ color: 'var(--red)' }}>Danger zone</h2>
        <div className="flex flex-col" style={{ gap: 'var(--space-xs)' }}>
          <p className="font-sans-label" style={{ color: 'var(--paper)' }}>Export your data</p>
          <p className="font-mono-micro">Download everything we hold about you as JSON — profile, products, campaigns, listings, scores.</p>
          <a className="font-mono-micro" style={{ color: 'var(--primary)', textDecoration: 'none' }} href="/api/account/export">
            Download export →
          </a>
        </div>
        <div className="flex flex-col" style={{ gap: 'var(--space-xs)' }}>
          <p className="font-sans-label" style={{ color: 'var(--paper)' }}>Delete account</p>
          <p className="font-mono-micro">
            Permanent. Removes your profile, products, campaigns, listings, and scores. Listings already published on external platforms stay on those platforms.
          </p>
          <form action="/api/account/delete" method="post" className="flex" style={{ gap: 'var(--space-sm)', alignItems: 'center', flexWrap: 'wrap' }}>
            <input
              className="input-field"
              style={{ width: 'auto' }}
              name="confirm"
              required
              pattern="DELETE"
              placeholder='Type "DELETE" to confirm'
              autoComplete="off"
            />
            <button className="btn-ghost" style={{ color: 'var(--red)', borderColor: 'var(--red)' }} type="submit">
              Delete my account
            </button>
          </form>
        </div>
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
