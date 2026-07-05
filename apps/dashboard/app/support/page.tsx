import type { Metadata } from 'next'
import { MarketingFooter } from '@/components/MarketingFooter'

export const metadata: Metadata = { title: 'Support — usersessions' }

const FAQ: { q: string; a: string }[] = [
  {
    q: 'The extension says “not connected”',
    a: 'Open the dashboard in the same browser while signed in — the extension picks up your session automatically within a few seconds. If it still shows not connected, reload the dashboard tab once.',
  },
  {
    q: 'My sign-in link never arrived',
    a: 'Check spam and promotions folders first. The resend button on the sign-in page has a short cooldown — wait for it, then resend. Corporate mail filters occasionally delay links by a few minutes.',
  },
  {
    q: 'A campaign finished but the dashboard shows nothing',
    a: 'Open the extension popup: if it shows “retry sync”, click it — your results are stored safely and will sync. This usually means the dashboard tab was signed out when the run finished.',
  },
  {
    q: 'Billing, upgrades, and cancellations',
    a: 'Manage your plan from Settings → Plan & billing. For anything involving a charge — refunds, failed payments, plan changes mid-cycle — email us and a human will sort it out.',
  },
]

export default function SupportPage() {
  return (
    <main style={{ maxWidth: 720, margin: '0 auto', padding: 'var(--space-2xl) var(--space-lg)' }}>
      <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: '2rem' }}>Support</h1>
      <p className="font-sans-body" style={{ marginTop: 'var(--space-sm)', maxWidth: 560 }}>
        Real humans, fast answers. Email us and we respond within one business day — usually much
        faster.
      </p>

      <div className="card" style={{ marginTop: 'var(--space-lg)' }}>
        <p className="font-mono-label" style={{ marginBottom: 'var(--space-xs)' }}>Email</p>
        <a
          href="mailto:support@usersessions.io"
          className="font-mono-data"
          style={{ color: 'var(--primary)', textDecoration: 'none' }}
        >
          support@usersessions.io
        </a>
      </div>

      <div className="flex flex-col" style={{ gap: 'var(--space-md)', marginTop: 'var(--space-xl)' }}>
        <h2 className="font-mono-label">Common questions</h2>
        {FAQ.map((item) => (
          <div key={item.q} className="card card--dense">
            <p className="font-sans-label" style={{ marginBottom: 'var(--space-xs)', color: 'var(--paper)' }}>
              {item.q}
            </p>
            <p className="font-sans-body">{item.a}</p>
          </div>
        ))}
      </div>

      <MarketingFooter />
    </main>
  )
}
