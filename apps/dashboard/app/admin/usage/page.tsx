import Link from 'next/link'
import { requireAdmin } from '@/lib/admin'
import { createServiceClient } from '@/lib/supabase/server'
import type { FeatureName } from '@usersessions/shared'

/**
 * Feature usage dashboard: which features are actually used, so dead ones can be pruned
 * after the 30-day post-freeze monitoring window. All numbers are computed from real
 * feature_events rows — no fabricated data, and an honest empty state if the table/rows
 * don't exist yet (migration 0034 not applied, or too early to have data).
 */

type SortKey = 'feature' | 'views' | 'generates' | 'submits' | 'users' | 'pctActive' | 'total'
const SORT_KEYS: SortKey[] = ['feature', 'views', 'generates', 'submits', 'users', 'pctActive', 'total']

interface Row {
  feature: FeatureName
  views: number
  generates: number
  submits: number
  users: Set<string>
  total: number
}

export default async function AdminUsagePage({
  searchParams,
}: {
  searchParams: Promise<{ sort?: string; dir?: string }>
}) {
  await requireAdmin()
  const params = await searchParams
  const sort: SortKey = SORT_KEYS.includes(params.sort as SortKey) ? (params.sort as SortKey) : 'total'
  const dir = params.dir === 'asc' ? 1 : -1

  const db = createServiceClient()
  const now = new Date()
  const sevenDaysAgo = new Date(now.getTime() - 7 * 86_400_000).toISOString()
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 86_400_000).toISOString()

  const [{ data: events7, error: err7 }, { data: events30, error: err30 }, { count: totalUsers }] = await Promise.all([
    db.from('feature_events').select('feature_name, event_type, user_id, created_at').gte('created_at', sevenDaysAgo).limit(50_000),
    db.from('feature_events').select('feature_name, user_id, created_at').gte('created_at', thirtyDaysAgo).limit(50_000),
    db.from('profiles').select('*', { count: 'exact', head: true }),
  ])

  // ---- Video generation stats (post-pivot product surface, from the videos table) ----
  const [{ data: videos7 }, { count: videosTotal }, { count: videosReady }, { count: videosFailed }] = await Promise.all([
    db.from('videos').select('user_id, status, created_at').gte('created_at', sevenDaysAgo).limit(50_000),
    db.from('videos').select('*', { count: 'exact', head: true }),
    db.from('videos').select('*', { count: 'exact', head: true }).in('status', ['ready', 'completed']),
    db.from('videos').select('*', { count: 'exact', head: true }).in('status', ['failed', 'scrape_failed', 'prompt_failed']),
  ])
  const videoUsers7 = new Set((videos7 ?? []).map((v: { user_id: string }) => v.user_id))
  const videos7Count = (videos7 ?? []).length
  const videoSuccessRate = (videosTotal ?? 0) > 0 ? Math.round(((videosReady ?? 0) / (videosTotal ?? 1)) * 100) : null

  const tableMissing = (m?: string) => m && /could not find the table|does not exist|schema cache/i.test(m)
  if ((err7 && !tableMissing(err7.message)) || (err30 && !tableMissing(err30.message))) {
    throw new Error(`Failed to load feature events (${err7?.message ?? err30?.message})`)
  }
  const rowsMissing = tableMissing(err7?.message) || tableMissing(err30?.message)

  // ---- 7-day breakdown, per feature ----
  const byFeature = new Map<FeatureName, Row>()
  const activeUsers7 = new Set<string>()
  const featuresTriedByUser = new Map<string, Set<FeatureName>>()
  for (const e of events7 ?? []) {
    const f = e.feature_name as FeatureName
    const row = byFeature.get(f) ?? { feature: f, views: 0, generates: 0, submits: 0, users: new Set<string>(), total: 0 }
    if (e.event_type === 'view') row.views++
    else if (e.event_type === 'generate') row.generates++
    else if (e.event_type === 'submit') row.submits++
    row.users.add(e.user_id)
    row.total++
    byFeature.set(f, row)
    activeUsers7.add(e.user_id)
    const tried = featuresTriedByUser.get(e.user_id) ?? new Set<FeatureName>()
    tried.add(f)
    featuresTriedByUser.set(e.user_id, tried)
  }

  const rows = [...byFeature.values()]
  const activeCount = activeUsers7.size || 1 // avoid div/0 in % calc
  const mostUsed = rows.length ? [...rows].sort((a, b) => b.total - a.total)[0] : null
  const leastUsed = rows.length ? [...rows].sort((a, b) => a.total - b.total)[0] : null
  const adoptedCount = [...featuresTriedByUser.values()].filter((s) => s.size >= 3).length
  const adoptionRate = activeUsers7.size > 0 ? Math.round((adoptedCount / activeUsers7.size) * 100) : 0

  const sorted = [...rows].sort((a, b) => {
    const av = sort === 'feature' ? a.feature : sort === 'views' ? a.views : sort === 'generates' ? a.generates : sort === 'submits' ? a.submits : sort === 'users' ? a.users.size : sort === 'pctActive' ? Math.round((a.users.size / activeCount) * 100) : a.total
    const bv = sort === 'feature' ? b.feature : sort === 'views' ? b.views : sort === 'generates' ? b.generates : sort === 'submits' ? b.submits : sort === 'users' ? b.users.size : sort === 'pctActive' ? Math.round((b.users.size / activeCount) * 100) : b.total
    if (typeof av === 'string') return dir * av.localeCompare(bv as string)
    return dir * ((av as number) - (bv as number))
  })

  // ---- 30-day dead-feature detection: <5% adoption (of 30-day active users) OR <3 total uses ----
  const byFeature30 = new Map<FeatureName, { total: number; users: Set<string> }>()
  const activeUsers30 = new Set<string>()
  for (const e of events30 ?? []) {
    const f = e.feature_name as FeatureName
    const agg = byFeature30.get(f) ?? { total: 0, users: new Set<string>() }
    agg.total++
    agg.users.add(e.user_id)
    byFeature30.set(f, agg)
    activeUsers30.add(e.user_id)
  }
  const active30 = activeUsers30.size || 1
  const deadFeatures = [...byFeature30.entries()]
    .map(([feature, agg]) => ({ feature, total: agg.total, users: agg.users.size, pct: Math.round((agg.users.size / active30) * 100) }))
    .filter((f) => f.pct < 5 || f.total < 3)
    .sort((a, b) => a.total - b.total)

  // ---- 30-day daily trend, top 5 features + "other" ----
  const days: string[] = []
  for (let i = 29; i >= 0; i--) days.push(new Date(now.getTime() - i * 86_400_000).toISOString().slice(0, 10))
  const top5 = [...byFeature30.entries()].sort((a, b) => b[1].total - a[1].total).slice(0, 5).map(([f]) => f)
  const dailyByFeature = new Map<string, number[]>()
  for (const f of [...top5, 'other']) dailyByFeature.set(f, days.map(() => 0))
  for (const e of events30 ?? []) {
    const day = e.created_at.slice(0, 10)
    const idx = days.indexOf(day)
    if (idx === -1) continue
    const f = top5.includes(e.feature_name as FeatureName) ? (e.feature_name as string) : 'other'
    const arr = dailyByFeature.get(f)
    if (arr) arr[idx]++
  }
  const series = [...dailyByFeature.entries()].map(([name, values]) => ({ name, values }))

  function sortLink(key: SortKey, label: string) {
    const nextDir = sort === key && dir === -1 ? 'asc' : 'desc'
    return (
      <Link href={`/admin/usage?sort=${key}&dir=${nextDir}`} className="font-mono-label" style={{ color: sort === key ? 'var(--primary)' : undefined, textDecoration: 'none' }}>
        {label}{sort === key ? (dir === -1 ? ' \u2193' : ' \u2191') : ''}
      </Link>
    )
  }

  return (
    <div className="flex flex-col" style={{ gap: 'var(--space-lg)' }}>
      <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.75rem' }}>Feature usage</h1>
      <p className="font-sans-body">
        Real usage from feature_events, so we can prune dead features after the 30-day freeze
        monitoring window. All-time-honest — empty states show zero, never a fabricated number.
      </p>

      {/* Video generation — same source of truth as the user dashboards (videos table) */}
      <div className="grid grid-cols-1 md:grid-cols-4" style={{ gap: 'var(--space-md)' }}>
        <div className="card">
          <p className="font-mono-label">Videos (all time)</p>
          <p className="font-serif-metric" style={{ fontSize: '2rem' }}>{videosTotal ?? 0}</p>
          <p className="font-mono-micro">{videos7Count} in last 7 days</p>
        </div>
        <div className="card">
          <p className="font-mono-label">Videos ready</p>
          <p className="font-serif-metric" style={{ fontSize: '2rem' }}>{videosReady ?? 0}</p>
          <p className="font-mono-micro">status ready/completed</p>
        </div>
        <div className="card">
          <p className="font-mono-label">Videos failed</p>
          <p className="font-serif-metric" style={{ fontSize: '2rem' }}>{videosFailed ?? 0}</p>
          <p className="font-mono-micro">incl. scrape/prompt failures</p>
        </div>
        <div className="card">
          <p className="font-mono-label">Video success rate</p>
          <p className="font-serif-metric" style={{ fontSize: '2rem' }}>{videoSuccessRate === null ? '—' : `${videoSuccessRate}%`}</p>
          <p className="font-mono-micro">{videoUsers7.size} generating users (7d)</p>
        </div>
      </div>

      {rowsMissing ? (
        <div className="card" style={{ borderColor: 'var(--amber)' }}>
          <p className="font-mono-label" style={{ color: 'var(--amber)' }}>Feature events table not found</p>
          <p className="font-sans-body">Migration 0034_feature_events has not been applied to this database yet.</p>
        </div>
      ) : (
        <>
          {/* Metrics cards — 7-day rolling */}
          <div className="grid grid-cols-1 md:grid-cols-4" style={{ gap: 'var(--space-md)' }}>
            <div className="card">
              <p className="font-mono-label">Active users (7d)</p>
              <p className="font-serif-metric" style={{ fontSize: '2rem' }}>{activeUsers7.size}</p>
              <p className="font-mono-micro">of {totalUsers ?? 0} total</p>
            </div>
            <div className="card">
              <p className="font-mono-label">Most used feature</p>
              <p className="font-mono-data" style={{ fontSize: '1.1rem' }}>{mostUsed?.feature ?? '\u2014'}</p>
              <p className="font-mono-micro">{mostUsed ? `${mostUsed.total} events` : 'no data yet'}</p>
            </div>
            <div className="card">
              <p className="font-mono-label">Least used feature</p>
              <p className="font-mono-data" style={{ fontSize: '1.1rem' }}>{leastUsed?.feature ?? '\u2014'}</p>
              <p className="font-mono-micro">{leastUsed ? `${leastUsed.total} events` : 'no data yet'}</p>
            </div>
            <div className="card">
              <p className="font-mono-label">Adoption rate</p>
              <p className="font-serif-metric" style={{ fontSize: '2rem' }}>{adoptionRate}%</p>
              <p className="font-mono-micro">tried ≥ 3 features (7d)</p>
            </div>
          </div>

          {/* 30-day daily trend */}
          <div className="card">
            <p className="font-mono-label" style={{ marginBottom: 'var(--space-md)' }}>Daily feature usage · 30 days</p>
            <p className="font-sans-body text-muted-foreground">Trend chart temporarily disabled.</p>
          </div>

          {/* Feature usage breakdown — sortable */}
          <div className="card card--dense">
            <p className="font-mono-label" style={{ marginBottom: 'var(--space-md)' }}>Feature usage breakdown · 7 days</p>
            {rows.length === 0 ? (
              <p className="font-sans-body">No feature events in the last 7 days.</p>
            ) : (
              <>
                <div className="flex" style={{ gap: 'var(--space-md)', paddingBottom: 'var(--space-xs)', borderBottom: '1px solid var(--border)' }}>
                  <span style={{ flex: 2 }}>{sortLink('feature', 'Feature')}</span>
                  <span style={{ width: 70, textAlign: 'right' }}>{sortLink('views', 'Views')}</span>
                  <span style={{ width: 90, textAlign: 'right' }}>{sortLink('generates', 'Generates')}</span>
                  <span style={{ width: 80, textAlign: 'right' }}>{sortLink('submits', 'Submits')}</span>
                  <span style={{ width: 110, textAlign: 'right' }}>{sortLink('users', 'Unique users')}</span>
                  <span style={{ width: 90, textAlign: 'right' }}>{sortLink('pctActive', '% of active')}</span>
                </div>
                {sorted.map((r) => (
                  <div key={r.feature} className="flex" style={{ gap: 'var(--space-md)', padding: 'var(--space-sm) 0', borderBottom: '1px solid var(--border)' }}>
                    <span className="font-mono-data" style={{ flex: 2 }}>{r.feature}</span>
                    <span className="font-mono-data" style={{ width: 70, textAlign: 'right' }}>{r.views}</span>
                    <span className="font-mono-data" style={{ width: 90, textAlign: 'right' }}>{r.generates}</span>
                    <span className="font-mono-data" style={{ width: 80, textAlign: 'right' }}>{r.submits}</span>
                    <span className="font-mono-data" style={{ width: 110, textAlign: 'right' }}>{r.users.size}</span>
                    <span className="font-mono-data" style={{ width: 90, textAlign: 'right' }}>{Math.round((r.users.size / activeCount) * 100)}%</span>
                  </div>
                ))}
              </>
            )}
          </div>

          {/* Dead features — auto-flagged red: <5% 30-day adoption OR <3 uses in 30 days */}
          <div className="card card--dense" style={{ borderColor: deadFeatures.length ? 'var(--red)' : undefined }}>
            <p className="font-mono-label" style={{ marginBottom: 'var(--space-md)', color: deadFeatures.length ? 'var(--red)' : undefined }}>
              Dead features · 30 days
            </p>
            {deadFeatures.length === 0 ? (
              <p className="font-sans-body">No features currently meet the dead-feature threshold.</p>
            ) : (
              deadFeatures.map((f) => (
                <div key={f.feature} className="flex" style={{ gap: 'var(--space-md)', padding: 'var(--space-sm) 0', borderBottom: '1px solid var(--border)' }}>
                  <span className="font-mono-data" style={{ flex: 1, color: 'var(--red)' }}>{f.feature}</span>
                  <span className="font-mono-micro">{f.total} uses</span>
                  <span className="font-mono-micro">{f.users} users</span>
                  <span className="font-mono-micro">{f.pct}% adoption</span>
                </div>
              ))
            )}
          </div>
        </>
      )}
    </div>
  )
}
