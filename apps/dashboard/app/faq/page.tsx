import Link from 'next/link'
import { MarketingFooter } from '@/components/MarketingFooter'

export const metadata = {
  title: 'FAQ — usersessions',
  description: 'How usersessions works: submissions in your own browser, verified listings, AI visibility tracking, pricing and cancellation.',
}

const FAQS: { q: string; a: string }[] = [
  {
    q: 'What does usersessions actually do?',
    a: 'It turns a landing page URL into a high-converting video ad. You paste your URL, we extract your positioning, write a script, generate the video, and provide auto-captions so you can post immediately to TikTok, Instagram Reels, or YouTube Shorts.',
  },
  {
    q: 'What AI models do you use?',
    a: 'We use Google Gemini Pro to extract product positioning and write the script, and the MiniMax Video-01 model to generate the actual high-definition video frames.',
  },
  {
    q: 'Do I own the rights to the generated videos?',
    a: 'Yes. You retain full commercial rights to every video generated under your account. You can use them in paid social campaigns, on your landing pages, or anywhere else without attribution.',
  },
  {
    q: 'Are the captions editable?',
    a: 'Yes. After the video generates, the auto-captions are displayed on the video page. You can edit the text directly before downloading or copying it to post.',
  },
  {
    q: 'How much does it cost?',
    a: 'The Free plan covers your first 3 videos per month. Starter is $39/month for 15 videos, and Pro is $99/month for 50 videos. All prices are in USD. You can cancel anytime from Settings.',
  },
  {
    q: 'How do I cancel?',
    a: 'Go to Settings → Plan & billing → Cancel subscription. Auto-renew turns off immediately, and your plan stays active until the end of the current billing period.',
  },
  {
    q: 'Can I export or delete my data?',
    a: 'Yes, self-service. Settings → Danger zone gives you a one-click JSON export of your profile and history, and an option for permanent account deletion.',
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
