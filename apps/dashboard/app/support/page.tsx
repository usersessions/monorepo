import type { Metadata } from 'next'
import { MarketingFooter } from '@/components/MarketingFooter'

export const metadata: Metadata = { title: 'Support — usersessions' }

const FAQ: { q: string; a: string }[] = [
  {
    q: 'My video is stuck in "Queued" or "Generating"',
    a: 'Video generation typically takes 1–3 minutes. If it stays queued for longer, open the video page and click "Retry Generation". This re-submits your prompt directly to our generation engine.',
  },
  {
    q: 'My sign-in link never arrived',
    a: 'Check spam and promotions folders first. The resend button on the sign-in page has a short cooldown — wait for it, then resend. Corporate mail filters occasionally delay links by a few minutes.',
  },
  {
    q: 'The video was generated but it looks wrong',
    a: 'You can edit the prompt from the video page and click "Retry Generation" to generate a new version using your updated prompt. Each retry creates a new video so your originals are preserved.',
  },
  {
    q: 'My plan credits are not updating after upgrading',
    a: 'Credits update in real time based on your plan. If your Overview still shows the wrong number, sign out and back in, or contact us — we will get it corrected immediately.',
  },
  {
    q: 'Billing, upgrades, and cancellations',
    a: 'Manage your plan from Settings → Plan & billing. For anything involving a charge — refunds, failed payments, plan changes mid-cycle — email us and a human will sort it out.',
  },
  {
    q: 'How do I download my videos?',
    a: 'Open any completed video from your Videos library. There is a download button directly on the video player. All videos are MP4 format optimised for TikTok, Instagram Reels, and YouTube Shorts.',
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
