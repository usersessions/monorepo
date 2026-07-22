import Link from 'next/link'
import { MarketingFooter } from '@/components/MarketingFooter'

const PLAN = [
  {
    step: '1. Paste',
    copy: 'Give us your product URL. We extract the branding, positioning, and target audience.',
  },
  {
    step: '2. Generate',
    copy: 'Our AI models write the script, generate the video, and add the voiceover.',
  },
  {
    step: '3. Post',
    copy: 'Download the final ad with optimized auto-captions, ready for TikTok or Reels.',
  },
]

export default function HomePage() {
  return (
    <>
      <main
        className="min-h-screen flex flex-col items-center justify-center text-center"
        style={{ gap: 'var(--space-xl)', padding: 'var(--space-2xl) var(--space-lg)' }}
      >
        <span className="italic" style={{ fontFamily: 'var(--font-serif)', fontSize: '2rem' }}>
          usersessions
        </span>

        <div className="flex flex-col items-center" style={{ gap: 'var(--space-md)' }}>
          <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: '2.5rem', maxWidth: 640, lineHeight: 1.15 }}>
            Turn your product page into a video ad.
          </h1>
          <p className="font-sans-body" style={{ maxWidth: 520 }}>
            Paste a URL, get a high-converting video ad in two minutes. We extract your product positioning, write the script, and generate the final video with voiceovers and captions.
          </p>
        </div>

        <div className="flex flex-col items-center" style={{ gap: 'var(--space-sm)' }}>
          <Link href="/signup" className="btn-primary" style={{ textDecoration: 'none' }}>
            Generate your first ad
          </Link>
          <Link href="/pricing" className="font-mono-micro" style={{ color: 'var(--muted)', textDecoration: 'none' }}>
            See pricing →
          </Link>
        </div>

        <div
          className="grid grid-cols-1 md:grid-cols-3 w-full"
          style={{ gap: 'var(--space-md)', maxWidth: 880, marginTop: 'var(--space-lg)' }}
        >
          {PLAN.map((p) => (
            <div key={p.step} className="card card--dense text-left">
              <p className="font-mono-label" style={{ marginBottom: 'var(--space-xs)' }}>
                {p.step}
              </p>
              <p className="font-sans-body">{p.copy}</p>
            </div>
          ))}
        </div>
      </main>
      <MarketingFooter />
    </>
  )
}
