import { createClient } from '@/lib/supabase/server'

const PLAN_ORDER: Record<string, number> = { free: 0, founder: 1, agency: 2 }

export default async function PlatformsPage() {
  const supabase = await createClient()

  const [{ data: platforms }, { data: { user } }] = await Promise.all([
    supabase.from('platforms').select('*'),
    supabase.auth.getUser(),
  ])
  const { data: profile } = await supabase.from('profiles').select('plan').eq('id', user!.id).single()
  const userPlanRank = PLAN_ORDER[profile?.plan ?? 'free'] ?? 0

  // Quality-sorted (computed first, else labeled editorial estimate)
  const sorted = [...(platforms ?? [])].sort(
    (a, b) => Number(b.quality_score ?? b.editorial_score ?? 0) - Number(a.quality_score ?? a.editorial_score ?? 0)
  )

  return (
    <div className="flex flex-col" style={{ gap: 'var(--space-lg)' }}>
      <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.75rem' }}>Platforms</h1>
      <p className="font-sans-body">
        The launch network. Quality values marked “est.” are editorial estimates until enough real
        submission data exists to compute the Platform Quality Score.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3" style={{ gap: 'var(--space-md)' }}>
        {sorted.map((p) => {
          const locked = (PLAN_ORDER[p.tier_required] ?? 0) > userPlanRank
          const quality = p.quality_score ?? p.editorial_score
          return (
            <div key={p.id} className="card card--dense" style={{ opacity: locked ? 0.5 : 1 }}>
              <div className="flex items-center" style={{ gap: 'var(--space-sm)' }}>
                <span className="font-sans-label" style={{ flex: 1 }}>{p.name}</span>
                <span className="font-mono-micro">{p.category}</span>
              </div>
              <p className="font-mono-data" style={{ marginTop: 'var(--space-sm)' }}>
                quality: {quality ?? '—'}
                {p.quality_score == null && p.editorial_score != null && (
                  <span className="font-mono-micro"> est.</span>
                )}
              </p>
              <div className="flex" style={{ gap: 'var(--space-sm)', marginTop: 'var(--space-sm)' }}>
                {!p.active && <span className="status-pending">adapter pending</span>}
                {p.active && <span className="status-live">available</span>}
                {locked && <span className="font-mono-micro" style={{ color: 'var(--muted)' }}>Upgrade to unlock · {p.tier_required}</span>}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
