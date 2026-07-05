import type { Metadata } from 'next'
import { MarketingFooter } from '@/components/MarketingFooter'

export const metadata: Metadata = { title: 'Privacy Policy — usersessions' }

const SECTIONS: { title: string; body: string[] }[] = [
  {
    title: '1. What we collect',
    body: [
      'Account data: your email address and, if you provide it, your name.',
      'Product data: the product URLs, titles, descriptions, and listing copy you provide or approve.',
      'Usage data: campaign and submission results, listing statuses, computed scores, and whether you edited AI-generated copy (used to improve copy quality).',
      'Payment data: subscriptions are processed by Paystack. We store your plan, subscription status, and billing references. We never see or store your full card number.',
    ],
  },
  {
    title: '2. The browser extension',
    body: [
      'The extension reads the content of a page only when you click Analyze on that page. It does not collect your browsing history, does not run on pages you have not asked it to, and requests only the minimum permissions needed to fill listing forms you approve.',
      'Your sign-in token is stored locally in the extension to connect it to your dashboard account. It is sent only to our own API.',
    ],
  },
  {
    title: '3. Service providers',
    body: [
      'We use Supabase (database, authentication), Vercel (hosting), Paystack (payments), Google (optional OAuth sign-in), Google Gemini (generating listing copy from the product data you provide), and Resend (transactional email such as digests and notifications). Each processes data only to provide its function.',
    ],
  },
  {
    title: '4. Cookies',
    body: [
      'We use cookies only to keep you signed in. There are no advertising or cross-site tracking cookies.',
    ],
  },
  {
    title: '5. Retention and deletion',
    body: [
      'We keep your data while your account is active. Contact support to export your data or delete your account; deletion removes your profile, products, campaigns, submissions, and scores.',
    ],
  },
  {
    title: '6. Security',
    body: [
      'Data is encrypted in transit, access is scoped per user at the database level (row-level security), and administrative actions are logged to an append-only audit log.',
    ],
  },
  {
    title: '7. Your rights',
    body: [
      'You can access, correct, export, or delete your personal data at any time by contacting support@usersessions.io. If you are in a jurisdiction with specific privacy rights (such as the GDPR), we honour those rights.',
    ],
  },
  {
    title: '8. Changes',
    body: [
      'If we materially change this policy, we will notify you by email or in the dashboard before the change takes effect.',
    ],
  },
  {
    title: '9. Contact',
    body: ['Privacy questions: support@usersessions.io.'],
  },
]

export default function PrivacyPage() {
  return (
    <main style={{ maxWidth: 720, margin: '0 auto', padding: 'var(--space-2xl) var(--space-lg)' }}>
      <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: '2rem' }}>Privacy Policy</h1>
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
