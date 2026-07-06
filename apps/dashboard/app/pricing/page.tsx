import { notFound } from 'next/navigation'
import Link from 'next/link'
import { isEnabled } from '@/lib/flags'
import { MarketingFooter } from '@/components/MarketingFooter'

export const dynamic = 'force-dynamic'

const TIERS = [
  {
    name: 'Free',
    price: '$0',
    period: '',
    features: ['1 product', 'Competitor scan', 'AI copy generation', '3 platform submissions', '1 AI Visibility query, monthly'],
    cta: null,
  },
  {
    name: 'Founder',
    price: '$39',
    period: '/mo · $390/yr',
    features: ['3 products', '2 launches per product / month', 'Full monitoring + auto-resubmission', '5 AI Visibility queries / product, weekly', 'Weekly digest + new-platform drops'],
    cta: [
      { label: 'Subscribe monthly', plan: 'founder_monthly' },
      { label: 'Subscribe yearly', plan: 'founder_annual' },
    ],
  },
  {
    name: 'Agency',
    price: '$199',
    period: '/mo',
    features: ['15 client workspaces', 'Pooled launches, priority', 'White-label reports', '10 AI Visibility queries / product, weekly', 'API access when it ships'],
    cta: [{ label: 'Subscribe monthly', plan: 'agency_monthly' }],
  },
]

const CHECKOUT_ERRORS: Record<string, string> = {
  not_configured: 'Payments are not fully configured yet — checkout is temporarily unavailable. Nothing was charged.',
  failed: 'Our payment provider could not start this checkout. Nothing was charged — please try again in a minute or contact support.',
  invalid_plan: 'That plan selection was not recognized. Please pick a plan below.',
}

export default async function PricingPage({
  searchParams,
}: {
  searchParams: Promise<{ checkout_error?: string }>
}) {
  // Real 404 while the flag is off — never a "coming soon" page (BUILD_SPEC §11).
  if (!(await isEnabled('pricing_page'))) notFound()

  const params = await searchParams
  const errorMessage = params.checkout_error ? CHECKOUT_ERRORS[params.checkout_error] : null

  return (
    <main style={{ maxWidth: 1080, margin: '0 auto', padding: 'var(--space-2xl) var(--space-lg)' }}>
      <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: '2rem', textAlign: 'center', marginBottom: 'var(--space-xl)' }}>
        Get your product found
      </h1>

      {errorMessage && (
        <div
          style={{
            border: '1px solid var(--red)',
            borderRadius: 'var(--rounded-sm)',
            padding: 'var(--space-sm) var(--space-md)',
            marginBottom: 'var(--space-lg)',
          }}
        >
          <p className="font-mono-label" style={{ color: 'var(--red)' }}>{errorMessage}</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3" style={{ gap: 'var(--space-lg)' }}>
        {TIERS.map((tier) => (
          <div key={tier.name} className="card" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
            <p className="font-mono-label">{tier.name}</p>
            <p>
              <span className="font-serif-metric" style={{ fontSize: '2.25rem' }}>{tier.price}</span>
              <span className="font-mono-micro">{tier.period}</span>
            </p>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 'var(--space-xs)' }}>
              {tier.features.map((f) => (
                <li key={f} className="font-sans-body">— {f}</li>
              ))}
            </ul>
            <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
              {tier.cta ? (
                tier.cta.map((c) => (
                  <form key={c.plan} method="post" action="/api/billing/checkout">
                    <input type="hidden" name="plan" value={c.plan} />
                    <button className="btn-primary" type="submit" style={{ width: '100%' }}>{c.label}</button>
                  </form>
                ))
              ) : (
                <Link href="/login" className="btn-ghost" style={{ textAlign: 'center', textDecoration: 'none' }}>
                  Start free
                </Link>
              )}
            </div>
          </div>
        ))}
      </div>

      <MarketingFooter />
    </main>
  )
}
