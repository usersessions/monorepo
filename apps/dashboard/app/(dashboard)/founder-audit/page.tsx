import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { limitsFor } from '@/lib/tiers'
import type { FounderAuditResult, FounderPlatformScore } from '@usersessions/shared'
import { FounderAuditRunner } from './FounderAuditRunner'

/**
 * Founder Brand Audit (Feature 3): scores a founder's personal profiles for product/category
 * signal and generates editable optimized copy. Honest — unreachable profiles score low with a
 * clear reason; never fabricated.
 */
export default async function FounderAuditPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: profile }, { data: products }] = await Promise.all([
    supabase.from('profiles').select('plan').eq('id', user.id).maybeSingle(),
    supabase.from('products').select('id, name').order('name'),
  ])
  const limits = limitsFor(profile?.plan)
  const product = (products ?? [])[0]

  let latest: FounderAuditResult | null = null
  if (product) {
    const { data: row } = await supabase
      .from('founder_audits')
      .select('product_id, overall_score, scores, top_priority, created_at')
      .eq('product_id', product.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (row) {
      latest = {
        productId: row.product_id,
        overallScore: row.overall_score,
        platforms: (row.scores as FounderPlatformScore[]) ?? [],
        topPriority: row.top_priority ?? '',
        auditedAt: row.created_at,
      }
    }
  }

  return (
    <div className="flex flex-col" style={{ gap: 'var(--space-lg)', maxWidth: 760 }}>
      <header className="flex flex-col" style={{ gap: 'var(--space-xs)' }}>
        <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.75rem' }}>Founder audit</h1>
        <p className="font-sans-body">
          How clearly your personal profiles signal that you build your product — the founder
          brand AI assistants and buyers check. Scores come from your live profiles, never estimated.
        </p>
      </header>

      {limits.founderAuditIntervalDays === 0 ? (
        <div className="card" style={{ borderColor: 'var(--amber)' }}>
          <p className="font-mono-label" style={{ color: 'var(--amber)' }}>Founder audit is a paid feature</p>
          <p className="font-sans-body">Upgrade to Founder or higher to audit your personal brand.</p>
          <a href="/pricing" className="font-mono-micro" style={{ color: 'var(--primary)', textDecoration: 'none' }}>Upgrade →</a>
        </div>
      ) : !product ? (
        <div className="card"><p className="font-sans-body">Add a product first, then audit your founder brand.</p></div>
      ) : (
        <FounderAuditRunner productId={product.id} initialAudit={latest} />
      )}
    </div>
  )
}
