import { TrendChart } from '@/components/TrendChart'
import { createClient } from '@/lib/supabase/server'

const WINDOWS_DAYS = [7, 30, 60, 90]
const LIVE = ['live', 'indexed']

export default async function AnalyticsPage() {
  const supabase = await createClient()

  const since = new Date(Date.now() - 90 * 24 * 3600 * 1000).toISOString()
  const [{ data: scores }, { data: subs }, { data: platforms }] = await Promise.all([
    supabase
      .from('distribution_scores')
      .select('score, computed_at')
      .gte('computed_at', since)
      .order('computed_at', { ascending: true }),
    supabase.from('submissions').select('platform_id, status, created_at, simulated'),
    supabase.from('platforms').select('id, name'),
  ])

  const platformName = new Map((platforms ?? []).map((p) => [p.id, p.name]))
  const real = (subs ?? []).filter((s) => !s.simulated)

  // Link survival: of real submissions older than each window, what share is still live?
  const survival = WINDOWS_DAYS.map((days) => {
    const cutoff = Date.now() - days * 24 * 3600 * 1000
    const cohort = real.filter((s) => new Date(s.created_at).getTime() <= cutoff)
    const alive = cohort.filter((s) => LIVE.includes(s.status)).length
    return { days, total: cohort.length, pct: cohort.length ? Math.round((alive / cohort.length) * 100) : null }
  })

  // Per-platform observed success (this user's own data only — no fabricated numbers)
  const byPlatform = new Map<string, { total: number; ok: number }>()
  for (const s of real) {
    const agg = byPlatform.get(s.platform_id) ?? { total: 0, ok: 0 }
    agg.total += 1
    if (LIVE.includes(s.status)) agg.ok += 1
    byPlatform.set(s.platform_id, agg)
  }
  const ranking = [...byPlatform.entries()]
    .map(([id, a]) => ({ id, ...a, rate: Math.round((a.ok / a.total) * 100) }))
    .sort((a, b) => b.rate - a.rate)

  return (
    <div className="flex flex-col" style={{ gap: 'var(--space-lg)' }}>
      <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.75rem' }}>Analytics</h1>

      <div className="card">
        <p className="font-mono-label" style={{ marginBottom: 'var(--space-md)' }}>Distribution Score · 90 days</p>
        <TrendChart points={scores ?? []} height={240} />
      </div>

      <div className="card card--dense">
        <p className="font-mono-label" style={{ marginBottom: 'var(--space-md)' }}>Link survival</p>
        {survival.every((s) => s.pct === null) ? (
          <p className="font-sans-body">Appears once your listings are old enough to measure.</p>
        ) : (
          <div className="flex" style={{ gap: 'var(--space-xl)' }}>
            {survival.map((s) => (
              <div key={s.days}>
                <p className="font-mono-label">{s.days}d</p>
                <p className="font-mono-data">{s.pct === null ? '—' : `${s.pct}%`}</p>
                <p className="font-mono-micro">{s.total} listings</p>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="card card--dense">
        <p className="font-mono-label" style={{ marginBottom: 'var(--space-md)' }}>Your platform performance</p>
        {ranking.length === 0 ? (
          <p className="font-sans-body">Appears after your first real (non-simulated) launch.</p>
        ) : (
          ranking.map((r) => (
            <div key={r.id} className="flex" style={{ gap: 'var(--space-md)', borderTop: '1px solid var(--border)', padding: 'var(--space-sm) 0' }}>
              <span className="font-mono-data" style={{ flex: 1 }}>{platformName.get(r.id) ?? r.id}</span>
              <span className="font-mono-data">{r.rate}%</span>
              <span className="font-mono-micro">{r.ok}/{r.total} live</span>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
