import { notFound } from 'next/navigation'
import Link from 'next/link'
import { isEnabled } from '@/lib/flags'
import { MarketingFooter } from '@/components/MarketingFooter'

export const dynamic = 'force-dynamic'

/**
 * Pricing — research-backed structure (see STABILIZATION_PROGRESS.md):
 * 3 self-serve cards (Free / Founder⭐ / Pro) + a visually separated Agency &
 * Enterprise callout that routes to the contact flow instead of self-checkout.
 * Annual-default toggle, center 'Most popular', charm pricing, risk reversal.
 */
function tiersFor(annual: boolean) {
  return [
    {
      name: 'Free',
      price: '$0',
      period: '',
      note: null as string | null,
      popular: false,
      features: ['1 product', '1 full launch — every platform', '30 days of full monitoring + weekly AI visibility', 'AIO Audit — weekly landing-page scorecard', 'Distribution Score + competitor scan', 'AI copy generation'],
      cta: null as { label: string; plan: string }[] | null,
    },
    {
      name: 'Founder',
      price: annual ? '$32.50' : '$39',
      period: '/mo',
      note: annual ? 'billed annually at $390 · save 17% (2 months free)' : 'or $32.50/mo billed annually',
      popular: true,
      features: ['3 products', '2 launches per product / month', 'Full monitoring + auto-resubmission', '5 AI Visibility queries / product, weekly', 'AIO Audit + weekly Intelligence Briefings', 'Reviews, community & referral toolkit', 'Weekly digest + new-platform drops'],
      cta: annual
        ? [
            { label: 'Subscribe yearly — $390', plan: 'founder_annual' },
            { label: 'Or monthly at $39/mo', plan: 'founder_monthly' },
          ]
        : [
            { label: 'Subscribe monthly — $39/mo', plan: 'founder_monthly' },
            { label: 'Or yearly at $390 (save 17%)', plan: 'founder_annual' },
          ],
    },
    {
      name: 'Pro',
      price: annual ? '$82.50' : '$99',
      period: '/mo',
      note: annual ? 'billed annually at $990 · save 17% (2 months free)' : 'or $82.50/mo billed annually',
      popular: false,
      features: ['10 products', '10 launches per product / month', 'Everything in Founder', '15 AI Visibility queries / product', 'Daily AIO Audit + intelligence briefings', 'Higher review, content & community volume', 'Priority resubmission & support'],
      cta: annual
        ? [
            { label: 'Subscribe yearly — $990', plan: 'pro_annual' },
            { label: 'Or monthly at $99/mo', plan: 'pro_monthly' },
          ]
        : [
            { label: 'Subscribe monthly — $99/mo', plan: 'pro_monthly' },
            { label: 'Or yearly at $990 (save 17%)', plan: 'pro_annual' },
          ],
    },
  ]
}

const CHECKOUT_ERRORS: Record<string, string> = {
  not_configured: 'Payments are not fully configured yet — checkout is temporarily unavailable. Nothing was charged.',
  failed: 'Our payment provider could not start this checkout. Nothing was charged — please try again in a minute or contact support.',
  invalid_plan: 'That plan selection was not recognized. Please pick a plan below.',
}

const PLAN_ENV_NAMES: Record<string, string> = {
  founder_monthly: 'PAYSTACK_PLAN_FOUNDER_MONTHLY',
  founder_annual: 'PAYSTACK_PLAN_FOUNDER_ANNUAL',
  pro_monthly: 'PAYSTACK_PLAN_PRO_MONTHLY',
  pro_annual: 'PAYSTACK_PLAN_PRO_ANNUAL',
  agency_monthly: 'PAYSTACK_PLAN_AGENCY_MONTHLY',
}

export default async function PricingPage({
  searchParams,
}: {
  searchParams: Promise<{ checkout_error?: string; cycle?: string; plan?: string; reason?: string }>
}) {
  // Real 404 while the flag is off — never a "coming soon" page (BUILD_SPEC §11).
  if (!(await isEnabled('pricing_page'))) notFound()

  const params = await searchParams
  const reasonDetail =
    params.checkout_error === 'failed' && params.reason ? ` Details: ${params.reason.slice(0, 180)}` : ''
  const errorMessage =
    params.checkout_error === 'not_configured' && params.plan && PLAN_ENV_NAMES[params.plan]
      ? `Checkout for “${params.plan}” is not configured on the server — the ${PLAN_ENV_NAMES[params.plan]} environment variable is missing or empty (set it in Vercel and redeploy). Nothing was charged.`
      : params.checkout_error
        ? `${CHECKOUT_ERRORS[params.checkout_error] ?? 'Checkout could not start. Nothing was charged.'}${reasonDetail}`
        : null
  const annual = params.cycle !== 'monthly' // annual is the default anchor
  const TIERS = tiersFor(annual)

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

      <div style={{ display: 'flex', justifyContent: 'center', gap: 'var(--space-md)', marginBottom: 'var(--space-lg)' }}>
        <a
          className="font-mono-label"
          style={{ color: annual ? 'var(--primary)' : 'var(--muted-2)', textDecoration: 'none' }}
          href="/pricing"
        >
          Annual · save 17%
        </a>
        <a
          className="font-mono-label"
          style={{ color: !annual ? 'var(--primary)' : 'var(--muted-2)', textDecoration: 'none' }}
          href="/pricing?cycle=monthly"
        >
          Monthly
        </a>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3" style={{ gap: 'var(--space-lg)' }}>
        {TIERS.map((tier) => (
          <div
            key={tier.name}
            className="card"
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--space-md)',
              borderColor: tier.popular ? 'var(--primary)' : undefined,
              position: 'relative',
            }}
          >
            {tier.popular && (
              <span className="font-mono-micro" style={{ position: 'absolute', top: 'var(--space-sm)', right: 'var(--space-md)', color: 'var(--primary)' }}>
                MOST POPULAR
              </span>
            )}
            <p className="font-mono-label">{tier.name}</p>
            <p>
              <span className="font-serif-metric" style={{ fontSize: '2.25rem' }}>{tier.price}</span>
              <span className="font-mono-micro">{tier.period}</span>
            </p>
            {tier.note && <p className="font-mono-micro">{tier.note}</p>}
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 'var(--space-xs)' }}>
              {tier.features.map((f) => (
                <li key={f} className="font-sans-body">— {f}</li>
              ))}
            </ul>
            <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
              {tier.cta ? (
                tier.cta.map((c, i) => (
                  <form key={c.plan} method="post" action="/api/billing/checkout">
                    <input type="hidden" name="plan" value={c.plan} />
                    <button className={i === 0 ? 'btn-primary' : 'btn-ghost'} type="submit" style={{ width: '100%' }}>
                      {c.label}
                    </button>
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

      {/* Agency & Enterprise — sales-assisted, visually separated from self-serve cards */}
      <div
        className="card"
        style={{
          marginTop: 'var(--space-lg)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 'var(--space-md)',
          borderColor: 'var(--amber)',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-xs)', maxWidth: 640 }}>
          <p className="font-mono-label" style={{ color: 'var(--amber)' }}>Agency &amp; Enterprise</p>
          <p className="font-sans-body">
            Custom pricing, from $299/mo — 15+ client workspaces, pooled priority launches,
            white-label reports, custom AI Visibility volume, and dedicated support.
          </p>
        </div>
        <Link href="/support" className="btn-primary" style={{ textDecoration: 'none', whiteSpace: 'nowrap' }}>
          Talk to us →
        </Link>
      </div>

      {/* Full feature comparison — values mirror PLAN_LIMITS so copy can't drift from enforcement. */}
      <div style={{ marginTop: 'var(--space-lg)', overflowX: 'auto' }}>
        <p className="font-mono-label" style={{ marginBottom: 'var(--space-sm)' }}>Compare every plan</p>
        <table className="font-sans-body" style={{ width: '100%', borderCollapse: 'collapse', minWidth: 640 }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left', padding: 'var(--space-xs)', borderBottom: '1px solid var(--border)' }}>Feature</th>
              <th style={{ textAlign: 'center', padding: 'var(--space-xs)', borderBottom: '1px solid var(--border)' }}>Free</th>
              <th style={{ textAlign: 'center', padding: 'var(--space-xs)', borderBottom: '1px solid var(--border)' }}>Founder</th>
              <th style={{ textAlign: 'center', padding: 'var(--space-xs)', borderBottom: '1px solid var(--border)' }}>Pro</th>
              <th style={{ textAlign: 'center', padding: 'var(--space-xs)', borderBottom: '1px solid var(--border)' }}>Agency</th>
            </tr>
          </thead>
          <tbody>
            {[
              ['Products', '1', '3', '10', '15+'],
              ['Launches / product / month', '1 lifetime', '2', '10', '10 (pooled)'],
              ['AI Visibility queries / product', '1', '5', '15', 'Custom'],
              ['AIO Audit', 'Weekly', 'Weekly', 'Daily', 'Daily'],
              ['Intelligence Briefings', '—', 'Weekly', 'Weekly', 'Weekly'],
              ['Comparison Content / month', '—', '2', '10', 'Unlimited'],
              ['Founder Brand Audit', '—', 'Monthly', 'Weekly', 'Weekly'],
              ['Review campaigns / month', '—', '1', '3', 'Unlimited'],
              ['Community responses / month', '—', '5', '20', 'Unlimited'],
              ['Referral programs / month', '—', '1', '3', 'Unlimited'],
              ['Support', 'Community', 'Standard', 'Priority', 'Dedicated'],
            ].map((row) => (
              <tr key={row[0]}>
                <td style={{ textAlign: 'left', padding: 'var(--space-xs)', borderBottom: '1px solid var(--border)' }}>{row[0]}</td>
                <td style={{ textAlign: 'center', padding: 'var(--space-xs)', borderBottom: '1px solid var(--border)' }}>{row[1]}</td>
                <td style={{ textAlign: 'center', padding: 'var(--space-xs)', borderBottom: '1px solid var(--border)' }}>{row[2]}</td>
                <td style={{ textAlign: 'center', padding: 'var(--space-xs)', borderBottom: '1px solid var(--border)' }}>{row[3]}</td>
                <td style={{ textAlign: 'center', padding: 'var(--space-xs)', borderBottom: '1px solid var(--border)' }}>{row[4]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="font-mono-micro" style={{ textAlign: 'center', marginTop: 'var(--space-lg)' }}>
        All prices in USD · Cancel anytime from Settings · 14-day money-back guarantee — email support and we refund, no questions.
      </p>

      <MarketingFooter />
    </main>
  )
}
