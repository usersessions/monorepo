import type { Metadata } from 'next'
import { MarketingFooter } from '@/components/MarketingFooter'

export const metadata: Metadata = { title: 'Privacy Policy — usersessions' }

const SECTIONS: { title: string; body: string[] }[] = [
  {
    title: '1. What we collect',
    body: [
      'Account data: your email address and, if you provide it, your name.',
      'Product data: the product URLs you provide for video generation.',
      'Usage data: video generation history, edited captions, and usage metrics.',
      'Payment data: subscriptions are processed by Paystack. We store your plan, subscription status, and billing references. We never see or store your full card number.',
    ],
  },
  {
    title: '2. Service providers',
    body: [
      'We use Supabase (database, authentication), Vercel (hosting), Paystack (payments), Google (optional OAuth sign-in), Google Gemini (extracting product positioning), MiniMax (generating video content), and Resend (transactional email). Each processes data only to provide its function.',
    ],
  },
  {
    title: '3. Cookies',
    body: [
      'We use cookies only to keep you signed in. There are no advertising or cross-site tracking cookies.',
    ],
  },
  {
    title: '4. Retention and deletion',
    body: [
      'We keep your data while your account is active. Contact support to export your data or delete your account; deletion removes your profile, URLs, and generated videos.',
    ],
  },
  {
    title: '5. Security',
    body: [
      'Data is encrypted in transit, access is scoped per user at the database level (row-level security), and administrative actions are logged to an append-only audit log.',
    ],
  },
  {
    title: '6. Your rights',
    body: [
      'You can access, correct, export, or delete your personal data at any time by contacting support@usersessions.io. If you are in a jurisdiction with specific privacy rights (such as the GDPR), we honour those rights.',
    ],
  },
  {
    title: '7. Changes',
    body: [
      'If we materially change this policy, we will notify you by email or in the dashboard before the change takes effect.',
    ],
  },
  {
    title: '8. Contact',
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
