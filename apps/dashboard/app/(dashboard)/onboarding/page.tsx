import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'

export default async function OnboardingPage() {
  const supabase = await createClient()

  const { count: videoCount } = await supabase
    .from('videos')
    .select('*', { count: 'exact', head: true })

  const hasVideo = (videoCount ?? 0) > 0

  const steps = [
    {
      title: '1. Paste your product URL',
      done: hasVideo,
      body: 'Simply paste your website or product page link. We analyze the page and extract your positioning so you don\'t have to type anything out.',
      cta: { label: 'Go to Generate →', href: '/generate' },
    },
    {
      title: '2. Approve the prompt',
      done: hasVideo,
      body: 'Our AI drafts a concise, high-converting video prompt based on your product. You get full control to edit every word before anything runs.',
      cta: null,
    },
    {
      title: '3. Generate',
      done: hasVideo,
      body: 'In about a minute, you get a beautiful 10-second cinematic video ad of your product in full HD.',
      cta: null,
    },
    {
      title: '4. Download & Post',
      done: hasVideo,
      body: 'Download the HD MP4 file. It\'s yours to use on TikTok, Instagram Reels, YouTube Shorts, or anywhere else.',
      cta: { label: 'Open your Videos →', href: '/videos' },
    },
  ]

  const nextStep = steps.find((s) => !s.done)

  return (
    <div className="flex flex-col" style={{ gap: 'var(--space-lg)', maxWidth: 640 }}>
      <header className="flex flex-col" style={{ gap: 'var(--space-xs)' }}>
        <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: '2rem' }}>Get started</h1>
        <p className="font-sans-body">
          Turn any product page into a ready-to-post video ad. This takes about 3 minutes.
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
          <h2 className="font-mono-label" style={{ color: 'var(--green)' }}>You&apos;re all set.</h2>
          <p className="font-sans-body">
            You&apos;ve successfully generated your first video ad. Head to your Videos library to download and post it.
          </p>
          <Link href="/videos" className="font-mono-micro" style={{ color: 'var(--primary)', textDecoration: 'none' }}>
            View your videos →
          </Link>
        </section>
      )}
    </div>
  )
}
