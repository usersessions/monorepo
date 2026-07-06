import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { removeWebhook, saveWebhook, sendTestNotification } from './actions'

const WEBHOOK_KINDS = [
  { kind: 'slack', name: 'Slack', hint: 'https://hooks.slack.com/services/…' },
  { kind: 'discord', name: 'Discord', hint: 'https://discord.com/api/webhooks/…' },
]

// Honest statuses only (BUILD_SPEC trust rule): nothing below is ever shown as Connected.
const COMING_SOON = [
  { name: 'Google Analytics', note: 'Deferred by design — every listing URL already carries UTM tags, so referrals show in your own GA today.' },
  { name: 'Google Search Console', note: 'Indexation attribution, planned post-validation.' },
  { name: 'Zapier', note: 'Trigger automations on campaign completion and dead-link alerts.' },
  { name: 'Public API', note: 'Programmatic access to campaigns, listings, and scores.' },
  { name: 'Notion export', note: 'Push campaign reports into your workspace.' },
]

export default async function IntegrationsPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; removed?: string; test?: string; error?: string }>
}) {
  const params = await searchParams
  const supabase = await createClient()
  const { data: rows } = await supabase.from('integrations').select('kind, webhook_url')
  const byKind = new Map((rows ?? []).map((r) => [r.kind, r]))

  const banner = (color: string, text: string) => (
    <div
      style={{
        border: `1px solid var(--${color})`,
        borderRadius: 'var(--rounded-sm)',
        padding: 'var(--space-sm) var(--space-md)',
      }}
    >
      <p className="font-mono-label" style={{ color: `var(--${color})` }}>{text}</p>
    </div>
  )

  return (
    <div className="flex flex-col" style={{ gap: 'var(--space-lg)', maxWidth: 640 }}>
      <header className="flex flex-col" style={{ gap: 'var(--space-xs)' }}>
        <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: '2rem' }}>Integrations</h1>
        <p className="font-sans-body">
          Send dead-link alerts and campaign updates where your team already looks.{' '}
          <Link href="/settings" style={{ color: 'var(--primary)', textDecoration: 'none' }}>← Back to settings</Link>
        </p>
      </header>

      {params.saved && banner('green', '✓ Webhook saved')}
      {params.removed && banner('green', '✓ Webhook removed')}
      {params.test === 'ok' && banner('green', '✓ Test notification delivered')}
      {params.test === 'fail' && banner('red', 'Test notification failed — check the webhook URL and try again')}
      {params.error === 'invalid_url' && banner('red', 'That does not look like a valid webhook URL for this service')}

      {WEBHOOK_KINDS.map(({ kind, name, hint }) => {
        const row = byKind.get(kind)
        return (
          <section key={kind} className="card flex flex-col" style={{ gap: 'var(--space-md)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h2 className="font-mono-label">{name}</h2>
              {row ? <span className="status-live">connected</span> : <span className="status-pending">available</span>}
            </div>
            {row ? (
              <>
                <p className="font-mono-micro">{row.webhook_url.slice(0, 44)}…</p>
                <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
                  <form action={sendTestNotification}>
                    <input type="hidden" name="kind" value={kind} />
                    <button className="btn-ghost" type="submit">Send test notification</button>
                  </form>
                  <form action={removeWebhook}>
                    <input type="hidden" name="kind" value={kind} />
                    <button className="btn-ghost" type="submit">Remove</button>
                  </form>
                </div>
              </>
            ) : (
              <form action={saveWebhook} className="flex flex-col" style={{ gap: 'var(--space-sm)' }}>
                <input type="hidden" name="kind" value={kind} />
                <label className="font-mono-label" htmlFor={`${kind}_url`}>Webhook URL</label>
                <input id={`${kind}_url`} name="webhook_url" className="input-field" type="url" placeholder={hint} required />
                <div>
                  <button className="btn-primary" type="submit">Connect {name}</button>
                </div>
              </form>
            )}
          </section>
        )
      })}

      <section className="card flex flex-col" style={{ gap: 'var(--space-md)' }}>
        <h2 className="font-mono-label">Coming soon</h2>
        {COMING_SOON.map((item) => (
          <div key={item.name} style={{ display: 'flex', gap: 'var(--space-md)', alignItems: 'flex-start', borderTop: '1px solid var(--border)', paddingTop: 'var(--space-sm)' }}>
            <div style={{ flex: 1 }}>
              <p className="font-sans-label" style={{ color: 'var(--paper)' }}>{item.name}</p>
              <p className="font-mono-micro">{item.note}</p>
            </div>
            <span className="status-pending">coming soon</span>
          </div>
        ))}
      </section>
    </div>
  )
}
