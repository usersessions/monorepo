import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'

/**
 * Guided first-run (BUILD_SPEC §2: Install → Launch → Watch, verbatim).
 * Steps check off from the user's REAL data — no fake progress.
 */
export default async function OnboardingPage() {
  const supabase = await createClient()

  const [{ count: productCount }, { count: videoCount }] = await Promise.all([
    supabase.from('products').select('*', { count: 'exact', head: true }),
    supabase.from('videos').select('*', { count: 'exact', head: true }),
  ])

  const steps = [
    {
      title: '1. Paste your product URL',
      done: (productCount ?? 0) > 0,
      body: 'Simply paste your website link. We analyze your landing page and product offering so you don\'t have to type anything out.',
      cta: { label: 'Add your product URL →', href: '/products/new' },
    },
    {
      title: '2. Approve the prompt',
      done: (videoCount ?? 0) > 0,
      body: 'Our AI drafts a concise, high-converting video prompt based on your product. You get full control to edit every word before anything runs.',
      cta: null,
    },
    {
      title: '3. Generate',
      done: (videoCount ?? 0) > 0,
      body: 'We send the prompt to MiniMax. In about a minute, you get a beautiful 10-second cinematic video ad of your product.',
      cta: null,
    },
    {
      title: '4. Download & Post',
      done: (videoCount ?? 0) > 0,
      body: 'Download the HD MP4 file. It\'s yours to use on TikTok, Instagram Reels, YouTube Shorts, or anywhere else.',
      cta: { label: 'Open your Overview →', href: '/' },
    },
  ]

  const nextStep = steps.find((s) => !s.done)

  return (
    <div className="flex flex-col" style={{ gap: 'var(--space-lg)', maxWidth: 640 }}>
      <header className="flex flex-col" style={{ gap: 'var(--space-xs)' }}>
        <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: '2rem' }}>Get your product found</h1>
        <p className="font-sans-body">
          Your product is built. This takes about 5 minutes, and at the end of it your product exists in the
          places people — and AI assistants — actually look.
        </p>
      </header>

      {steps.map((step) => (
        <section
          key={step.title}
          className="card flex flex-col"
          style={{
            gap: 'var(--space-sm)',
            borderColor: step === nextStep ? 'var(--primary)' : undefined,
            opacity: step.done ? 0.75 : 1,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h2 className="font-mono-label">{step.title}</h2>
            {step.done ? (
              <span className="status-live">done</span>
            ) : step === nextStep ? (
              <span className="status-running">you are here</span>
            ) : (
              <span className="status-pending">up next</span>
            )}
          </div>
          <p className="font-sans-body">{step.body}</p>
          {step.cta && !step.done && step === nextStep && (
            <Link href={step.cta.href} className="font-mono-micro" style={{ color: 'var(--primary)', textDecoration: 'none' }}>
              {step.cta.label}
            </Link>
          )}
        </section>
      ))}

      {!nextStep && (
        <section className="card flex flex-col" style={{ gap: 'var(--space-sm)', borderColor: 'var(--green)' }}>
          <h2 className="font-mono-label" style={{ color: 'var(--green)' }}>You're all set.</h2>
          <p className="font-sans-body">
            You've successfully generated your first AI video ad. You can create more videos from your dashboard anytime.
          </p>
          <Link href="/" className="font-mono-micro" style={{ color: 'var(--primary)', textDecoration: 'none' }}>
            Go to Overview →
          </Link>
        </section>
      )}
    </div>
  )
}
