import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { limitsFor } from '@/lib/tiers'
import type { CommunityOpportunity, CommunitySurface } from '@usersessions/shared'
import { CommunityFeed } from './CommunityFeed'

/**
 * Communities (Feature 5): a curated opportunity feed + assisted, honest response drafting.
 * The founder posts every reply themselves. Reddit is intentionally excluded to protect accounts.
 */
export default async function CommunitiesPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: profile }, { data: products }, { data: opps }] = await Promise.all([
    supabase.from('profiles').select('plan').eq('id', user.id).maybeSingle(),
    supabase.from('products').select('id, name').order('name'),
    supabase
      .from('community_opportunities')
      .select('id, surface, url, title, content_snippet, relevance_score, status, created_at')
      .order('created_at', { ascending: false })
      .limit(100),
  ])
  const limits = limitsFor(profile?.plan)
  const product = (products ?? [])[0]

  const opportunities: CommunityOpportunity[] = (opps ?? []).map((o) => ({
    id: o.id,
    surface: o.surface as CommunitySurface,
    url: o.url,
    title: o.title,
    contentSnippet: o.content_snippet,
    relevanceScore: o.relevance_score,
    status: o.status,
    createdAt: o.created_at,
  }))

  return (
    <div className="flex flex-col" style={{ gap: 'var(--space-lg)', maxWidth: 820 }}>
      <header className="flex flex-col" style={{ gap: 'var(--space-xs)' }}>
        <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.75rem' }}>Communities</h1>
        <p className="font-sans-body">
          Track relevant discussions and draft honest, helpful replies. You post every response
          yourself, in your own account. We help first, sell never — the fastest way to be trusted.
        </p>
      </header>

      {limits.communityResponsesPerMonth === 0 ? (
        <div className="card" style={{ borderColor: 'var(--amber)' }}>
          <p className="font-mono-label" style={{ color: 'var(--amber)' }}>Community responses are a paid feature</p>
          <p className="font-sans-body">Upgrade to Founder or higher to draft community responses.</p>
          <a href="/pricing" className="font-mono-micro" style={{ color: 'var(--primary)', textDecoration: 'none' }}>Upgrade →</a>
        </div>
      ) : !product ? (
        <div className="card"><p className="font-sans-body">Add a product first, then track community opportunities.</p></div>
      ) : (
        <CommunityFeed productId={product.id} initialOpportunities={opportunities} />
      )}
    </div>
  )
}
