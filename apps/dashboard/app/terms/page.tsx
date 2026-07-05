import type { Metadata } from 'next'
import { MarketingFooter } from '@/components/MarketingFooter'

export const metadata: Metadata = { title: 'Terms of Service — usersessions' }

const SECTIONS: { title: string; body: string[] }[] = [
  {
    title: '1. The service',
    body: [
      'usersessions is a distribution engine for software products. It helps you submit listings to third-party directories and launch platforms via our browser extension, verifies that listings remain live, and measures whether AI assistants mention your product. The extension performs assisted automation in your own browser: you approve all copy before anything is submitted, and steps such as CAPTCHAs and email confirmations remain yours to complete.',
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
      'You may only submit products you own or are authorised to represent. You are responsible for complying with the terms of each third-party platform you submit to. You must not use the service to distribute misleading, unlawful, or infringing content, and you must not attempt to abuse, overload, or reverse-engineer the service.',
    ],
  },
  {
    title: '6. The extension',
    body: [
      'The extension runs in your browser using your own platform accounts and sessions. We do not create accounts on your behalf and we do not collect your browsing history. Rate limits and pacing exist to keep submissions respectful of third-party platforms; you agree not to circumvent them.',
    ],
  },
  {
    title: '7. Your content',
    body: [
      'You retain all rights to the product information and listing copy you provide or approve. You grant us the limited licence needed to operate the service: storing your listings, submitting your approved copy to the platforms you choose, and displaying your data back to you.',
    ],
  },
  {
    title: '8. Disclaimers',
    body: [
      'We do not control third-party platforms. We cannot guarantee that any platform will accept a listing, keep it live, or that any AI assistant will recommend your product. Scores and metrics are computed from real observed data and are provided for information, not as a guarantee of outcomes. The service is provided on an as-is basis.',
    ],
  },
  {
    title: '9. Liability',
    body: [
      'To the maximum extent permitted by law, our total liability arising out of the service is limited to the amount you paid us in the twelve months before the claim arose.',
    ],
  },
  {
    title: '10. Termination',
    body: [
      'You can stop using the service and delete your account at any time by contacting support. We may suspend or terminate accounts that violate these terms, with notice where practical.',
    ],
  },
  {
    title: '11. Changes',
    body: [
      'We may update these terms as the product evolves. If a change is material, we will notify you by email or in the dashboard before it takes effect. Continuing to use the service after a change means you accept the updated terms.',
    ],
  },
  {
    title: '12. Contact',
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
