import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { limitsFor } from '@/lib/tiers'
import type { ReferralProgramCopy, ReferralProgramView, ReferralStructure } from '@usersessions/shared'
import { ReferralGenerator } from './ReferralGenerator'

const STRUCTURE_LABEL: Record<ReferralStructure, string> = {
  give_get: 'Give-get',
  credits: 'Credits',
  discount: 'Discount',
  cash: 'Cash',
  tiered: 'Tiered',
}

/**
 * Referrals (Feature 6): AI proposes a referral structure + full copy set the founder implements
 * in their own product. Honest — no fabricated metrics.
 */
export default async function ReferralsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: profile }, { data: products }, { data: existing }] = await Promise.all([
    supabase.from('profiles').select('plan').eq('id', user.id).maybeSingle(),
    supabase.from('products').select('id, name').order('name'),
    supabase
      .from('referral_programs')
      .select('id, structure_type, generated_copy, implemented_url, created_at')
      .order('created_at', { ascending: false })
      .limit(10),
  ])
  const limits = limitsFor(profile?.plan)
  const product = (products ?? [])[0]
  const programs: ReferralProgramView[] = (existing ?? []).map((r) => ({
    id: r.id,
    structureType: r.structure_type as ReferralStructure,
    copy: (r.generated_copy as ReferralProgramCopy) ?? ({} as ReferralProgramCopy),
    implementedUrl: r.implemented_url,
    createdAt: r.created_at,
  }))

  return (
    <div className="flex flex-col" style={{ gap: 'var(--space-lg)', maxWidth: 820 }}>
      <header className="flex flex-col" style={{ gap: 'var(--space-xs)' }}>
        <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.75rem' }}>Referral program</h1>
        <p className="font-sans-body">
          Get a referral structure and the full copy set — landing page, in-app tooltip, invite
          email, and announcement — tuned to your pricing. Implement it in your own product.
        </p>
      </header>

      {limits.referralProgramsPerMonth === 0 ? (
        <div className="card" style={{ borderColor: 'var(--amber)' }}>
          <p className="font-mono-label" style={{ color: 'var(--amber)' }}>Referral generation is a paid feature</p>
          <p className="font-sans-body">Upgrade to Founder or higher to generate a referral program.</p>
          <a href="/pricing" className="font-mono-micro" style={{ color: 'var(--primary)', textDecoration: 'none' }}>Upgrade →</a>
        </div>
      ) : !product ? (
        <div className="card"><p className="font-sans-body">Add a product first, then generate a referral program.</p></div>
      ) : (
        <ReferralGenerator productId={product.id} />
      )}

      {programs.length > 0 && (
        <div className="card card--dense flex flex-col" style={{ gap: 'var(--space-sm)' }}>
          <p className="font-mono-label">Saved programs</p>
          {programs.map((p) => (
            <div key={p.id} className="flex items-center" style={{ gap: 'var(--space-md)', borderTop: '1px solid var(--border)', paddingTop: 'var(--space-sm)' }}>
              <span className="font-mono-micro" style={{ color: 'var(--cyan)', width: 90 }}>{STRUCTURE_LABEL[p.structureType]}</span>
              <span className="font-mono-micro" style={{ flex: 1 }}>{p.copy.landingHeadline || new Date(p.createdAt).toISOString().slice(0, 10)}</span>
              {p.implementedUrl ? (
                <a className="font-mono-micro" style={{ color: 'var(--primary)' }} href={p.implementedUrl} target="_blank" rel="noreferrer">live ↗</a>
              ) : (
                <span className="status-pending">draft</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
