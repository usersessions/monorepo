import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

/**
 * Reason-mapped cancellation flow (research-backed; see STABILIZATION_PROGRESS.md).
 * One question, one mapped save offer (single-offer keeps CA ARL-compliant),
 * and cancellation always remains one click away — never a dark pattern.
 */
const REASONS: { id: string; label: string }[] = [
  { id: 'price', label: 'It costs too much' },
  { id: 'timing', label: "I don't need it right now" },
  { id: 'usage', label: "I'm not using enough of it" },
  { id: 'feature', label: "It's missing something I need" },
  { id: 'other', label: 'Something else' },
]

function Offer({ reason }: { reason: string }) {
  if (reason === 'price' || reason === 'usage') {
    return (
      <div className="card flex flex-col" style={{ gap: 'var(--space-sm)', borderColor: 'var(--primary)' }}>
        <p className="font-mono-label" style={{ color: 'var(--primary)' }}>Keep the monitoring, drop the cost</p>
        <p className="font-sans-body">
          Switch to Founder at $39/mo — your listings stay monitored, dead links keep getting
          resubmitted, and your AI Visibility history stays intact.
        </p>
        <form method="post" action="/api/billing/checkout">
          <input type="hidden" name="plan" value="founder_monthly" />
          <button className="btn-primary" type="submit">Downgrade to Founder — $39/mo</button>
        </form>
      </div>
    )
  }
  if (reason === 'timing') {
    return (
      <div className="card flex flex-col" style={{ gap: 'var(--space-sm)', borderColor: 'var(--primary)' }}>
        <p className="font-mono-label" style={{ color: 'var(--primary)' }}>Pause instead?</p>
        <p className="font-sans-body">
          We can pause your subscription for up to 60 days — no charges while paused, and your
          listings, score history and AI Visibility data stay exactly where you left them.
        </p>
        <Link href="/support" className="btn-primary" style={{ textDecoration: 'none', width: 'fit-content' }}>
          Request a pause →
        </Link>
      </div>
    )
  }
  return (
    <div className="card flex flex-col" style={{ gap: 'var(--space-sm)', borderColor: 'var(--primary)' }}>
      <p className="font-mono-label" style={{ color: 'var(--primary)' }}>Tell us what’s missing</p>
      <p className="font-sans-body">
        We answer fast and we ship fast. If something you need is missing, there is a real chance
        it is already on the way — tell us and we will give you a straight answer.
      </p>
      <Link href="/support" className="btn-primary" style={{ textDecoration: 'none', width: 'fit-content' }}>
        Contact support →
      </Link>
    </div>
  )
}

export default async function CancelPage({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string }>
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { reason } = await searchParams
  const validReason = REASONS.some((r) => r.id === reason) ? reason : undefined

  return (
    <div className="flex flex-col" style={{ gap: 'var(--space-lg)', maxWidth: 560 }}>
      <header className="flex flex-col" style={{ gap: 'var(--space-xs)' }}>
        <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.75rem' }}>Cancel subscription</h1>
        <p className="font-sans-body">
          Before you go — one question so we can either fix it or get out of your way.
        </p>
      </header>

      {!validReason ? (
        <form method="get" className="card flex flex-col" style={{ gap: 'var(--space-md)' }}>
          <p className="font-mono-label">Why are you cancelling?</p>
          <div className="flex flex-col" style={{ gap: 'var(--space-sm)' }}>
            {REASONS.map((r) => (
              <label key={r.id} style={{ display: 'flex', gap: 'var(--space-sm)', alignItems: 'center', cursor: 'pointer' }}>
                <input type="radio" name="reason" value={r.id} required style={{ accentColor: 'var(--primary)' }} />
                <span className="font-sans-body" style={{ color: 'var(--paper)' }}>{r.label}</span>
              </label>
            ))}
          </div>
          <div className="flex" style={{ gap: 'var(--space-md)' }}>
            <button className="btn-primary" type="submit">Continue</button>
            <Link href="/settings" className="btn-ghost" style={{ textDecoration: 'none' }}>
              Keep my plan
            </Link>
          </div>
        </form>
      ) : (
        <>
          <Offer reason={validReason} />

          {/* Cancellation is always one click away — single offer, no dark patterns. */}
          <form action="/api/billing/cancel" method="post" className="flex" style={{ gap: 'var(--space-md)', alignItems: 'center' }}>
            <button className="btn-ghost" style={{ color: 'var(--red)', borderColor: 'var(--red)' }} type="submit">
              Cancel my subscription
            </button>
            <Link href="/settings" className="font-mono-micro" style={{ color: 'var(--muted)', textDecoration: 'none' }}>
              Never mind, keep my plan
            </Link>
          </form>
          <p className="font-mono-micro">
            Cancelling turns off auto-renew — your plan stays active until the end of the paid period,
            and your data stays intact either way.
          </p>
        </>
      )}
    </div>
  )
}
