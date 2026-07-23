import { requireAdmin } from '@/lib/admin'
import { createServiceClient } from '@/lib/supabase/server'

const READY = ['ready', 'completed']
const FAILED = ['failed', 'scrape_failed', 'prompt_failed']

/**
 * Usage dashboard — video generation activity from the videos table, the same
 * source of truth as the user dashboards. The legacy feature_events view was
 * removed with the video pivot.
 */
export default async function AdminUsagePage() {
  await requireAdmin()
  const db = createServiceClient()
  const now = new Date()
  const sevenDaysAgo = new Date(now.getTime() - 7 * 86_400_000).toISOString()
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 86_400_000).toISOString()

  const [{ data: videos30 }, { count: videosTotal }, { count: videosReady }, { count: videosFailed }, { count: totalUsers }, { data: profiles }] = await Promise.all([
    db.from('videos').select('user_id, status, created_at').gte('created_at', thirtyDaysAgo).limit(50_000),
    db.from('videos').select('*', { count: 'exact', head: true }),
    db.from('videos').select('*', { count: 'exact', head: true }).in('status', READY),
    db.from('videos').select('*', { count: 'exact', head: true }).in('status', FAILED),
    db.from('profiles').select('*', { count: 'exact', head: true }),
    db.from('profiles').select('id, email').limit(10_000),
  ])

  const emailById = new Map((profiles ?? []).map((p) => [p.id, p.email]))
  const rows30 = videos30 ?? []
  const rows7 = rows30.filter((v) => v.created_at >= sevenDaysAgo)
  const users7 = new Set(rows7.map((v) => v.user_id))
  const successRate = (videosTotal ?? 0) > 0 ? Math.round(((videosReady ?? 0) / (videosTotal ?? 1)) * 100) : null

  // Per-user breakdown · 30 days
  const byUser = new Map<string, { total: number; ready: number; failed: number }>()
  for (const v of rows30) {
    const agg = byUser.get(v.user_id) ?? { total: 0, ready: 0, failed: 0 }
    agg.total++
    if (READY.includes(v.status)) agg.ready++
    if (FAILED.includes(v.status)) agg.failed++
    byUser.set(v.user_id, agg)
  }
  const topUsers = [...byUser.entries()].map(([id, a]) => ({ id, ...a })).sort((a, b) => b.total - a.total).slice(0, 20)

  // Status breakdown · 30 days
  const byStatus = new Map<string, number>()
  for (const v of rows30) byStatus.set(v.status, (byStatus.get(v.status) ?? 0) + 1)
  const statuses = [...byStatus.entries()].sort((a, b) => b[1] - a[1])

  return (
    <div className="flex flex-col" style={{ gap: 'var(--space-lg)' }}>
      <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.75rem' }}>Usage</h1>
      <p className="font-sans-body">
        Video generation activity, computed from the videos table — the same source of truth
        as the user dashboards. Honest empty states; nothing here is fabricated.
      </p>

      {/* Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4" style={{ gap: 'var(--space-md)' }}>
        <div className="card">
          <p className="font-mono-label">Videos (all time)</p>
          <p className="font-serif-metric" style={{ fontSize: '2rem' }}>{videosTotal ?? 0}</p>
          <p className="font-mono-micro">{rows7.length} in last 7 days · {rows30.length} in last 30</p>
        </div>
        <div className="card">
          <p className="font-mono-label">Ready</p>
          <p className="font-serif-metric" style={{ fontSize: '2rem' }}>{videosReady ?? 0}</p>
          <p className="font-mono-micro">status ready/completed</p>
        </div>
        <div className="card">
          <p className="font-mono-label">Failed</p>
          <p className="font-serif-metric" style={{ fontSize: '2rem' }}>{videosFailed ?? 0}</p>
          <p className="font-mono-micro">incl. scrape/prompt failures</p>
        </div>
        <div className="card">
          <p className="font-mono-label">Success rate</p>
          <p className="font-serif-metric" style={{ fontSize: '2rem' }}>{successRate === null ? '—' : `${successRate}%`}</p>
          <p className="font-mono-micro">{users7.size} generating users (7d) of {totalUsers ?? 0} total</p>
        </div>
      </div>

      {/* Per-user breakdown · 30 days */}
      <div className="card card--dense">
        <p className="font-mono-label" style={{ marginBottom: 'var(--space-md)' }}>Top users · 30 days</p>
        {topUsers.length === 0 ? (
          <p className="font-sans-body">No videos generated in the last 30 days.</p>
        ) : (
          <>
            <div className="flex" style={{ gap: 'var(--space-md)', paddingBottom: 'var(--space-xs)', borderBottom: '1px solid var(--border)' }}>
              <span className="font-mono-label" style={{ flex: 2 }}>User</span>
              <span className="font-mono-label" style={{ width: 80, textAlign: 'right' }}>Videos</span>
              <span className="font-mono-label" style={{ width: 80, textAlign: 'right' }}>Ready</span>
              <span className="font-mono-label" style={{ width: 80, textAlign: 'right' }}>Failed</span>
            </div>
            {topUsers.map((u) => (
              <div key={u.id} className="flex" style={{ gap: 'var(--space-md)', padding: 'var(--space-sm) 0', borderBottom: '1px solid var(--border)' }}>
                <span className="font-mono-data" style={{ flex: 2, overflow: 'hidden', textOverflow: 'ellipsis' }}>{emailById.get(u.id) ?? `${u.id.slice(0, 8)}…`}</span>
                <span className="font-mono-data" style={{ width: 80, textAlign: 'right' }}>{u.total}</span>
                <span className="font-mono-data" style={{ width: 80, textAlign: 'right' }}>{u.ready}</span>
                <span className="font-mono-data" style={{ width: 80, textAlign: 'right', color: u.failed ? 'var(--red)' : undefined }}>{u.failed}</span>
              </div>
            ))}
          </>
        )}
      </div>

      {/* Status breakdown · 30 days */}
      <div className="card card--dense">
        <p className="font-mono-label" style={{ marginBottom: 'var(--space-md)' }}>Status breakdown · 30 days</p>
        {statuses.length === 0 ? (
          <p className="font-sans-body">No videos generated in the last 30 days.</p>
        ) : (
          statuses.map(([status, count]) => (
            <div key={status} className="flex" style={{ gap: 'var(--space-md)', padding: 'var(--space-sm) 0', borderTop: '1px solid var(--border)' }}>
              <span className="font-mono-data" style={{ flex: 1 }}>{status}</span>
              <span className="font-mono-data">{count}</span>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
