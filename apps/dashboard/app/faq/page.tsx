import Link from 'next/link'
import { MarketingFooter } from '@/components/MarketingFooter'

export const metadata = {
  title: 'FAQ — usersessions',
  description: 'How usersessions works: submissions in your own browser, verified listings, AI visibility tracking, pricing and cancellation.',
}

const FAQS: { q: string; a: string }[] = [
  {
    q: 'What does usersessions actually do?',
    a: 'It gets your product listed everywhere AI assistants and humans discover software — AI tool indexes and startup launch platforms — then monitors whether those listings stay live and whether AI assistants mention you. The plan is three steps: Install the extension, Launch (approve your copy, we submit everywhere), Watch (see where you are live and whether AI recommends you).',
  },
  {
    q: 'Is this automated spam?',
    a: 'No, by design. Submissions run in your own browser, with your own accounts. There is no automated account creation, no proxies, no link farms. You handle CAPTCHAs and email confirmations yourself — the extension does the tedious form-filling and tracking. Assisted automation, never 100% hands-off.',
  },
  {
    q: 'Do I control what gets submitted?',
    a: 'Completely. AI-generated listing copy is shown to you word by word before anything is submitted, and every field is editable. Nothing is ever posted without your approval.',
  },
  {
    q: 'What is the Distribution Score?',
    a: 'A 0–100 score computed from your verified listings: platform coverage, average platform quality, link survival and indexation. It is computed from real data only — no estimates, no fabricated numbers — and its history is append-only, so trends are honest.',
  },
  {
    q: 'What is AI Visibility?',
    a: 'Weekly checks of your category queries across ChatGPT, Perplexity and Gemini, recording verbatim whether the assistant mentions your product. Weeks where you are not mentioned are shown exactly as that — never smoothed over.',
  },
  {
    q: 'What happens when a listing goes dead?',
    a: 'Our nightly checker verifies your listings. A listing is only marked removed after failing continuously for 48 hours — a single transient failure never triggers an alert. Paid plans queue an automatic resubmission; free plans get notified and can resubmit manually from the Listings page.',
  },
  {
    q: 'How much does it cost?',
    a: 'Free covers 1 product and your first 3 submissions. Founder is $39/month (or $390/year — two months free) with full monitoring and auto-resubmission. Agency is $199/month with 15 client workspaces and white-label reports. All prices in USD, cancel anytime from Settings, 14-day money-back guarantee.',
  },
  {
    q: 'How do I cancel?',
    a: 'Settings → Plan & billing → Cancel subscription. Auto-renew turns off immediately and your plan stays active until the end of the paid period. Your data stays intact either way.',
  },
  {
    q: 'Can I export or delete my data?',
    a: 'Yes, both, self-service. Settings → Danger zone gives you a one-click JSON export of everything we hold about you, and permanent account deletion. Listings already published on external platforms remain on those platforms — they are yours.',
  },
  {
    q: 'Do you use my Google Analytics or Search Console?',
    a: 'Not yet, by choice. Every listing URL we submit carries UTM tags, so referral traffic already shows up attributed in your own analytics. Direct integrations are planned after our measurement approach is validated — we would rather ship them right than early.',
  },
]

export default function FaqPage() {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: FAQS.map((f) => ({
      '@type': 'Question',
      name: f.q,
      acceptedAnswer: { '@type': 'Answer', text: f.a },
    })),
  }

  return (
    <main style={{ maxWidth: 720, margin: '0 auto', padding: 'var(--space-2xl) var(--space-lg)' }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }} />
      <Link href="/" className="italic" style={{ fontFamily: 'var(--font-serif)', fontSize: '1.25rem', color: 'var(--paper)', textDecoration: 'none' }}>
        usersessions
      </Link>
      <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: '2rem', margin: 'var(--space-xl) 0 var(--space-lg)' }}>Frequently asked questions</h1>

      <div className="flex flex-col" style={{ gap: 'var(--space-md)' }}>
        {FAQS.map((f) => (
          <section key={f.q} className="card flex flex-col" style={{ gap: 'var(--space-xs)' }}>
            <h2 className="font-sans-label" style={{ color: 'var(--paper)', fontSize: '1.05rem' }}>{f.q}</h2>
            <p className="font-sans-body">{f.a}</p>
          </section>
        ))}
      </div>

      <MarketingFooter />
    </main>
  )
}
