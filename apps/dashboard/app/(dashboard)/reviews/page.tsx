import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { limitsFor } from '@/lib/tiers'
import { ReviewCampaignBuilder } from './ReviewCampaignBuilder'

/**
 * Reviews (Feature 1): request honest reviews from your own activated users and track the
 * sent → opened → clicked → reviewed funnel. Never fake, gate, or incentivize a review.
 */
export default async function ReviewsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: profile }, { data: products }, { data: platforms }, { data: campaigns }] = await Promise.all([
    supabase.from('profiles').select('plan').eq('id', user.id).maybeSingle(),
    supabase.from('products').select('id, name').order('name'),
    supabase.from('review_platforms').select('id, name, tier_unlock').eq('active', true).order('quality_score', { ascending: false }),
    supabase.from('review_campaigns').select('id, status, created_at').order('created_at', { ascending: false }).limit(20),
  ])

  const limits = limitsFor(profile?.plan)
  const plan = profile?.plan ?? 'free'
  const ids = (campaigns ?? []).map((c) => c.id)
  const { data: reqs } = ids.length
    ? await supabase.from('review_requests').select('review_campaign_id, status').in('review_campaign_id', ids)
    : { data: [] as any[] }

  return (
    <div className="flex flex-col" style={{ gap: 'var(--space-lg)', maxWidth: 820 }}>
      <header className="flex flex-col" style={{ gap: 'var(--space-xs)' }}>
        <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.75rem' }}>Reviews</h1>
        <p className="font-sans-body">
          Ask your own activated users for an honest review, and watch the funnel. We never fake,
          gate, or pay for reviews — we just make the ask easy and personal.
        </p>
      </header>

      {limits.reviewCampaignsPerMonth === 0 ? (
        <div className="card" style={{ borderColor: 'var(--amber)' }}>
          <p className="font-mono-label" style={{ color: 'var(--amber)' }}>Review campaigns are a paid feature</p>
          <p className="font-sans-body">Upgrade to Founder or higher to run review-request campaigns.</p>
          <a href="/pricing" className="font-mono-micro" style={{ color: 'var(--primary)', textDecoration: 'none' }}>Upgrade →</a>
        </div>
      ) : (products ?? []).length === 0 ? (
        <div className="card"><p className="font-sans-body">Add a product first, then run a review campaign.</p></div>
      ) : (
        <ReviewCampaignBuilder
          products={products ?? []}
          platforms={(platforms ?? []).map((p) => ({ id: p.id, name: p.name }))}
          perCampaign={limits.reviewRequestsPerCampaign}
        />
      )}

      {/* Existing campaigns + funnel */}
      {(campaigns ?? []).length > 0 && (
        <div className="card card--dense flex flex-col" style={{ gap: 'var(--space-md)' }}>
          <p className="font-mono-label">Your campaigns</p>
          {(campaigns ?? []).map((c) => {
            const rows = (reqs ?? []).filter((r) => r.review_campaign_id === c.id)
            const n = (st: string[]) => rows.filter((r) => st.includes(r.status)).length
            const funnel = [
              ['Sent', n(['sent', 'opened', 'clicked', 'reviewed'])],
              ['Opened', n(['opened', 'clicked', 'reviewed'])],
              ['Clicked', n(['clicked', 'reviewed'])],
              ['Reviewed', n(['reviewed'])],
            ] as const
            return (
              <div key={c.id} style={{ borderTop: '1px solid var(--border)', paddingTop: 'var(--space-sm)' }}>
                <div className="flex items-center" style={{ gap: 'var(--space-md)' }}>
                  <span className="font-mono-micro" style={{ flex: 1 }}>{new Date(c.created_at).toISOString().slice(0, 10)} · {rows.length} requests</span>
                  <span className="status-pending">{c.status}</span>
                </div>
                <div className="flex" style={{ gap: 'var(--space-lg)', marginTop: 'var(--space-xs)' }}>
                  {funnel.map(([label, v]) => (
                    <div key={label}>
                      <p className="font-mono-micro">{label}</p>
                      <p className="font-mono-data">{v}</p>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
