import { TrendChart } from '@/components/TrendChart'
import { createClient } from '@/lib/supabase/server'
import { QUERY_TYPE_WEIGHT, type VisibilityQueryType } from '@usersessions/shared'
import { addVisibilityQuery, deleteVisibilityQuery } from './actions'
import { SuggestQueries } from './SuggestQueries'

const WINDOWS_DAYS = [7, 30, 60, 90]
const LIVE = ['live', 'indexed']

const QUERY_TYPE_LABEL: Record<VisibilityQueryType, string> = {
  category_direct: 'Category',
  use_case: 'Use case',
  comparison: 'Comparison',
  alternative: 'Alternative',
}

export default async function AnalyticsPage() {
  const supabase = await createClient()

  const since = new Date(Date.now() - 90 * 24 * 3600 * 1000).toISOString()
  const [{ data: scores }, { data: subs }, { data: platforms }, { data: products }, { data: queries }, { data: checks }, { data: competitors }] = await Promise.all([
    supabase
      .from('distribution_scores')
      .select('score, computed_at')
      .gte('computed_at', since)
      .order('computed_at', { ascending: true }),
    supabase.from('submissions').select('platform_id, status, created_at, simulated'),
    supabase.from('platforms').select('id, name'),
    supabase.from('products').select('id, name'),
    supabase.from('visibility_queries').select('id, product_id, query, query_type'),
    supabase
      .from('visibility_checks')
      .select('query_id, engine, mentioned, rank, snippet, checked_at')
      .order('checked_at', { ascending: false })
      .limit(200),
    supabase.from('visibility_competitors').select('query_id, competitor_name'),
  ])

  const platformName = new Map((platforms ?? []).map((p) => [p.id, p.name]))
  const real = (subs ?? []).filter((s) => !s.simulated)

  // ---- Category Ownership Score: weighted by query type, using each query's latest check ----
  const latestByQuery = new Map<string, { mentioned: boolean; rank: number | null }>()
  for (const c of checks ?? []) {
    if (!latestByQuery.has(c.query_id)) latestByQuery.set(c.query_id, { mentioned: c.mentioned, rank: c.rank })
  }
  let ownWeight = 0
  let gotWeight = 0
  const gaps: string[] = []
  const compByQuery = new Map<string, Set<string>>()
  for (const c of competitors ?? []) {
    const set = compByQuery.get(c.query_id) ?? new Set<string>()
    set.add(c.competitor_name)
    compByQuery.set(c.query_id, set)
  }
  for (const q of queries ?? []) {
    const w = QUERY_TYPE_WEIGHT[(q.query_type as VisibilityQueryType) ?? 'category_direct']
    ownWeight += w
    const latest = latestByQuery.get(q.id)
    if (latest?.mentioned) {
      // Rank 1 earns full weight; deeper ranks decay gently but never below 40%.
      const rankFactor = latest.rank ? Math.max(0.4, 1 - (latest.rank - 1) * 0.1) : 0.8
      gotWeight += w * rankFactor
    } else if ((compByQuery.get(q.id)?.size ?? 0) > 0) {
      gaps.push(q.query) // competitors appear, we don't
    }
  }
  const ownershipScore = ownWeight > 0 ? Math.round((gotWeight / ownWeight) * 100) : null

  // ---- Share of Voice: self vs top competitors across all tracked queries ----
  const totalQueries = (queries ?? []).length
  const selfMentions = [...latestByQuery.values()].filter((v) => v.mentioned).length
  const compCounts = new Map<string, number>()
  for (const [, names] of compByQuery) for (const n of names) compCounts.set(n, (compCounts.get(n) ?? 0) + 1)
  const sov = [
    { name: 'You', mentions: selfMentions, isSelf: true },
    ...[...compCounts.entries()].map(([name, mentions]) => ({ name, mentions, isSelf: false })),
  ]
    .sort((a, b) => b.mentions - a.mentions)
    .slice(0, 4)
  const sovMax = Math.max(1, ...sov.map((s) => s.mentions))

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

      <div className="card">
        <p className="font-mono-label" style={{ marginBottom: 'var(--space-md)' }}>Category Ownership</p>
        {ownershipScore === null ? (
          <p className="font-sans-body">
            Track category queries below, then the weekly check computes how much of your category
            you own — weighted by query importance. No estimates until real checks land.
          </p>
        ) : (
          <>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 'var(--space-md)' }}>
              <span className="font-serif-metric" style={{ fontSize: '2.5rem', color: ownershipScore >= 50 ? 'var(--green)' : ownershipScore >= 25 ? 'var(--amber)' : 'var(--red)' }}>{ownershipScore}</span>
              <span className="font-mono-micro">out of 100 · weighted across {totalQueries} tracked {totalQueries === 1 ? 'query' : 'queries'}</span>
            </div>
            {/* Share of voice: you vs top competitors */}
            <div className="flex flex-col" style={{ gap: 'var(--space-sm)', marginTop: 'var(--space-md)' }}>
              <p className="font-mono-label">Share of voice</p>
              {sov.map((s) => (
                <div key={s.name} className="flex items-center" style={{ gap: 'var(--space-md)' }}>
                  <span className="font-mono-data" style={{ width: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: s.isSelf ? 'var(--primary)' : 'var(--paper)' }}>{s.name}</span>
                  <div className="meter" style={{ flex: 1 }}>
                    <span style={{ width: `${Math.round((s.mentions / sovMax) * 100)}%`, background: s.isSelf ? 'var(--primary)' : 'var(--muted-2)' }} />
                  </div>
                  <span className="font-mono-micro">{s.mentions}</span>
                </div>
              ))}
            </div>
            {gaps.length > 0 && (
              <p className="font-mono-micro" style={{ marginTop: 'var(--space-md)', color: 'var(--amber)' }}>
                Gap: competitors appear but you don’t for {gaps.length} {gaps.length === 1 ? 'query' : 'queries'} — e.g. “{gaps[0]}”.
              </p>
            )}
          </>
        )}
      </div>

      <div className="card card--dense">
        <p className="font-mono-label" style={{ marginBottom: 'var(--space-md)' }}>AI Visibility</p>
        <p className="font-sans-body" style={{ marginBottom: 'var(--space-md)' }}>
          Weekly checks of whether AI assistants recommend you for these queries. Currently
          measured via Gemini; more engines as their keys are configured. Results are shown
          verbatim — including the weeks you are not mentioned.
        </p>

        {(queries ?? []).map((q) => {
          const latest = (checks ?? []).find((c) => c.query_id === q.id)
          const qType = (q.query_type as VisibilityQueryType) ?? 'category_direct'
          return (
            <div key={q.id} style={{ borderTop: '1px solid var(--border)', padding: 'var(--space-sm) 0' }}>
              <div className="flex items-center" style={{ gap: 'var(--space-md)' }}>
                <span className="font-mono-micro" style={{ color: 'var(--cyan)', width: 84 }}>{QUERY_TYPE_LABEL[qType]}</span>
                <span className="font-mono-data" style={{ flex: 1 }}>“{q.query}”</span>
                {latest ? (
                  <span className={latest.mentioned ? 'status-live' : 'status-dead'}>
                    {latest.mentioned ? `mentioned${latest.rank ? ` #${latest.rank}` : ''}` : 'not mentioned'}
                  </span>
                ) : (
                  <span className="status-pending">first check pending</span>
                )}
                <form action={deleteVisibilityQuery}>
                  <input type="hidden" name="queryId" value={q.id} />
                  <button className="btn-ghost" type="submit">Remove</button>
                </form>
              </div>
              {latest?.snippet && (
                <p className="font-mono-micro" style={{ marginTop: 'var(--space-xs)' }}>{latest.engine}: “{latest.snippet}”</p>
              )}
            </div>
          )
        })}

        {(products ?? []).length === 0 ? (
          <p className="font-sans-body" style={{ marginTop: 'var(--space-md)' }}>
            Run your first launch to create a product, then add the queries your customers would ask.
          </p>
        ) : (
          <form action={addVisibilityQuery} className="flex" style={{ gap: 'var(--space-sm)', marginTop: 'var(--space-md)', flexWrap: 'wrap' }}>
            <select name="productId" className="input-field" style={{ width: 'auto' }}>
              {(products ?? []).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <select name="queryType" className="input-field" style={{ width: 'auto' }} aria-label="Query type">
              <option value="category_direct">Category</option>
              <option value="use_case">Use case</option>
              <option value="comparison">Comparison</option>
              <option value="alternative">Alternative</option>
            </select>
            <input name="query" className="input-field" style={{ flex: 1, minWidth: 220 }} placeholder='e.g. "best AI tool for writing changelogs"' />
            <button className="btn-ghost" type="submit">Track query</button>
          </form>
        )}

        {(products ?? []).length > 0 && <SuggestQueries productId={(products ?? [])[0].id} />}
      </div>
    </div>
  )
}
