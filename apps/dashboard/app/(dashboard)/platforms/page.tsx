import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'

const PLAN_ORDER: Record<string, number> = { free: 0, founder: 1, agency: 2 }
const CATEGORY_LABELS: Record<string, string> = {
  ai: 'AI tool indexes',
  startup: 'Startup launch platforms',
}

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
  const liveCount = sorted.filter((p) => p.active).length
  const categories = [...new Set(sorted.map((p) => p.category))]

  return (
    <div className="flex flex-col" style={{ gap: 'var(--space-xl)' }}>
      <header className="flex flex-col" style={{ gap: 'var(--space-sm)' }}>
        <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: '2rem' }}>Platforms</h1>
        <p className="font-sans-body" style={{ maxWidth: 640 }}>
          The launch network. Quality values marked “est.” are editorial estimates until enough real
          submission data exists to compute the Platform Quality Score.
        </p>
        <p className="font-mono-data">
          <span style={{ color: 'var(--green)' }}>{liveCount} live</span>
          <span style={{ color: 'var(--muted-2)' }}> · {sorted.length - liveCount} pending</span>
        </p>
      </header>

      {categories.map((cat) => (
        <section key={cat} className="flex flex-col" style={{ gap: 'var(--space-md)' }}>
          <h2 className="font-mono-label">{CATEGORY_LABELS[cat] ?? cat}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3" style={{ gap: 'var(--space-md)' }}>
            {sorted
              .filter((p) => p.category === cat)
              .map((p) => {
                const locked = (PLAN_ORDER[p.tier_required] ?? 0) > userPlanRank
                const quality = Number(p.quality_score ?? p.editorial_score ?? 0)
                const isEstimate = p.quality_score == null
                return (
                  <div key={p.id} className="card card--dense flex flex-col" style={{ gap: 'var(--space-sm)' }}>
                    <div className="flex items-center" style={{ gap: 'var(--space-sm)' }}>
                      <span className="font-sans-label" style={{ flex: 1, color: 'var(--paper)' }}>
                        {p.name}
                      </span>
                      {p.active ? (
                        <span className="status-live">live</span>
                      ) : (
                        <span className="status-pending">coming soon</span>
                      )}
                    </div>

                    <div className="flex items-center" style={{ gap: 'var(--space-sm)' }}>
                      <div className="meter" style={{ flex: 1 }}>
                        <span
                          className={isEstimate ? 'meter--estimate' : undefined}
                          style={{ width: `${Math.min(quality, 100)}%` }}
                        />
                      </div>
                      <span className="font-mono-data">
                        {quality || '—'}
                        {isEstimate && quality ? <span className="font-mono-micro"> est.</span> : null}
                      </span>
                    </div>

                    {locked ? (
                      <Link
                        href="/pricing"
                        className="font-mono-micro"
                        style={{ color: 'var(--amber)', textDecoration: 'none' }}
                      >
                        Unlock with {p.tier_required} →
                      </Link>
                    ) : (
                      <span className="font-mono-micro">included in your plan</span>
                    )}
                  </div>
                )
              })}
          </div>
        </section>
      ))}
    </div>
  )
}
