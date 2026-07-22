import type { Metadata } from 'next'
import { MarketingFooter } from '@/components/MarketingFooter'

export const metadata: Metadata = { title: 'Terms of Service — usersessions' }

const SECTIONS: { title: string; body: string[] }[] = [
  {
    title: '1. The service',
    body: [
      'usersessions is an AI video generation platform. It helps you turn product landing pages into video advertisements using AI models. We extract positioning data from the URLs you provide and generate video frames, voiceovers, and captions based on that data.',
    ],
  },
  {
    title: '2. Your account',
    body: [
      'You must provide a valid email address to create an account. You are responsible for activity that happens under your account. Keep access to your email secure — sign-in links are sent there.',
    ],
  },
  {
    title: '3. Subscriptions and billing',
    body: [
      'Paid plans are recurring subscriptions billed through Paystack. Prices are shown on the pricing page before you subscribe. Your subscription renews automatically until cancelled. You can cancel at any time; cancellation takes effect at the end of the current billing period, and you keep paid features until then.',
      'If a renewal payment fails, we will notify you and may downgrade your account to the free plan after a grace period.',
    ],
  },
  {
    title: '4. Refunds',
    body: [
      'If something went wrong with a charge, contact support within 14 days of that charge and we will work it out with you. We do not offer refunds for partial billing periods after cancellation.',
    ],
  },
  {
    title: '5. Acceptable use',
    body: [
      'You may only submit product URLs you own or are authorized to represent. You are responsible for the videos you generate and ensuring they do not contain misleading, unlawful, or infringing content. You must not attempt to abuse, overload, or reverse-engineer the service or the underlying AI models.',
    ],
  },
  {
    title: '6. Your content and intellectual property',
    body: [
      'You retain all rights to the product URLs and information you provide. You also own the full commercial rights to the videos generated through the service. You grant us a limited licence to store the video files and process the inputs via third-party AI providers (Google and MiniMax) to operate the service.',
    ],
  },
  {
    title: '7. Disclaimers',
    body: [
      'We do not control the third-party AI models (Google Gemini and MiniMax) that generate the videos. We cannot guarantee the exact visual output of any video generation request. The service is provided on an as-is basis.',
    ],
  },
  {
    title: '8. Liability',
    body: [
      'To the maximum extent permitted by law, our total liability arising out of the service is limited to the amount you paid us in the twelve months before the claim arose.',
    ],
  },
  {
    title: '9. Termination',
    body: [
      'You can stop using the service and delete your account at any time by contacting support. We may suspend or terminate accounts that violate these terms, with notice where practical.',
    ],
  },
  {
    title: '10. Changes',
    body: [
      'We may update these terms as the product evolves. If a change is material, we will notify you by email or in the dashboard before it takes effect. Continuing to use the service after a change means you accept the updated terms.',
    ],
  },
  {
    title: '11. Contact',
    body: ['Questions about these terms: support@usersessions.io.'],
  },
]

export default function TermsPage() {
  return (
    <main style={{ maxWidth: 720, margin: '0 auto', padding: 'var(--space-2xl) var(--space-lg)' }}>
      <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: '2rem' }}>Terms of Service</h1>
      <p className="font-mono-micro" style={{ marginTop: 'var(--space-xs)' }}>Effective July 5, 2026</p>

      <div className="flex flex-col" style={{ gap: 'var(--space-lg)', marginTop: 'var(--space-xl)' }}>
        {SECTIONS.map((s) => (
          <section key={s.title}>
            <h2 className="font-mono-label" style={{ marginBottom: 'var(--space-xs)' }}>
              {s.title}
            </h2>
            {s.body.map((p, i) => (
              <p key={i} className="font-sans-body" style={{ marginBottom: 'var(--space-sm)' }}>
                {p}
              </p>
            ))}
          </section>
        ))}
      </div>

      <MarketingFooter />
    </main>
  )
}
