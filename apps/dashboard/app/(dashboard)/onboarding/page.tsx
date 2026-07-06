import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'

/**
 * Guided first-run (BUILD_SPEC §2: Install → Launch → Watch, verbatim).
 * Steps check off from the user's REAL data — no fake progress.
 */
export default async function OnboardingPage() {
  const supabase = await createClient()

  const [{ count: productCount }, { count: campaignCount }, { count: liveCount }] = await Promise.all([
    supabase.from('products').select('*', { count: 'exact', head: true }),
    supabase.from('campaigns').select('*', { count: 'exact', head: true }),
    supabase.from('submissions').select('*', { count: 'exact', head: true }).in('status', ['live', 'indexed']),
  ])

  const steps = [
    {
      title: '1. Install the extension',
      done: (campaignCount ?? 0) > 0, // a campaign can only come from the extension
      body: 'The extension runs submissions in your own browser, your own accounts — nothing happens behind your back.',
      cta: { label: 'Get the extension →', href: '/support' },
    },
    {
      title: '2. Add your product',
      done: (productCount ?? 0) > 0,
      body: 'Open the extension on your product\u2019s landing page and click \u201cAnalyze this page\u201d — we read your title, description and headings so you never re-type what your product is.',
      cta: null,
    },
    {
      title: '3. Launch your first campaign',
      done: (campaignCount ?? 0) > 0,
      body: 'Generate listing copy, edit every word until it sounds like you, approve it, and hit Launch. You handle CAPTCHAs and email confirmations — we do the tedious 90%.',
      cta: null,
    },
    {
      title: '4. Watch',
      done: (liveCount ?? 0) > 0,
      body: 'Your dashboard tracks where you\u2019re live, resurfaces dead listings, and checks whether AI assistants mention you for your category.',
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
          <h2 className="font-mono-label" style={{ color: 'var(--green)' }}>You\u2019re live.</h2>
          <p className="font-sans-body">
            The monitoring loop is running: dead listings get flagged, resubmissions get queued, and AI
            visibility is tracked weekly. Check your Overview any time.
          </p>
          <Link href="/" className="font-mono-micro" style={{ color: 'var(--primary)', textDecoration: 'none' }}>
            Go to Overview →
          </Link>
        </section>
      )}
    </div>
  )
}
