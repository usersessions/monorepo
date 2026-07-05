import { createClient } from '@/lib/supabase/server'
import { TrendChart } from '@/components/TrendChart'

const STEPS = ['Install', 'Launch', 'Watch'] as const // verbatim StoryBrand plan — BUILD_SPEC §2

const DAY_MS = 24 * 60 * 60 * 1000

export default async function OverviewPage() {
  const supabase = await createClient()
  const ninetyDaysAgo = new Date(Date.now() - 90 * DAY_MS).toISOString()
  const thirtyDaysAgo = new Date(Date.now() - 30 * DAY_MS).toISOString()

  const [
    { count: campaignCount },
    { count: submissionCount },
    { count: liveCount },
    { data: latestScore },
    { data: trend },
    { data: visibilityChecks },
    { data: recent },
    { data: notifications },
  ] = await Promise.all([
    supabase.from('campaigns').select('*', { count: 'exact', head: true }),
    supabase.from('submissions').select('*', { count: 'exact', head: true }),
    supabase
      .from('submissions')
      .select('*', { count: 'exact', head: true })
      .in('status', ['live', 'indexed']),
    supabase
      .from('distribution_scores')
      .select('score, computed_at')
      .order('computed_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('distribution_scores')
      .select('score, computed_at')
      .gte('computed_at', ninetyDaysAgo)
      .order('computed_at', { ascending: true })
      .limit(180),
    supabase.from('visibility_checks').select('mentioned').gte('checked_at', thirtyDaysAgo),
    supabase
      .from('submissions')
      .select('platform_id, status, created_at')
      .order('created_at', { ascending: false })
      .limit(10),
    supabase
      .from('notifications')
      .select('id, kind, title, body, read, created_at')
      .order('created_at', { ascending: false })
      .limit(8),
  ])

  // AI Visibility: HONEST mention rate across real checks — never smoothed,
  // never fabricated (BUILD_SPEC §10). Null until real checks exist.
  const checks = visibilityChecks ?? []
  const mentionRate =
    checks.length > 0
      ? Math.round((checks.filter((c) => c.mentioned).length / checks.length) * 100)
      : null

  const trendPoints = (trend ?? []).map((p) => ({
    score: Number(p.score),
    computed_at: p.computed_at as string,
  }))

  const doneByStep = [Boolean(campaignCount), Boolean(campaignCount), Boolean(submissionCount)]

  return (
    <div className="flex flex-col" style={{ gap: 'var(--space-lg)' }}>
      <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.75rem' }}>Overview</h1>

      {/* Progress: Install → Launch → Watch */}
      <div className="card--dense card flex" style={{ gap: 'var(--space-lg)' }}>
        {STEPS.map((step, i) => (
          <div key={step} className="flex items-center" style={{ gap: 'var(--space-sm)' }}>
            <span
              className="font-mono-label"
              style={{ color: doneByStep[i] ? 'var(--green)' : 'var(--muted-2)' }}
            >
              {i + 1}. {step}
            </span>
            {i < STEPS.length - 1 && <span style={{ color: 'var(--muted-2)' }}>→</span>}
          </div>
        ))}
      </div>

      {/* Metric cards — real values only, honest empty states otherwise */}
      <div className="grid grid-cols-1 md:grid-cols-3" style={{ gap: 'var(--space-lg)' }}>
        <div className="card">
          <p className="font-mono-label">Distribution Score</p>
          {latestScore ? (
            <>
              <p className="font-serif-metric">{latestScore.score}</p>
              <p className="font-mono-micro">
                computed {new Date(latestScore.computed_at).toISOString().slice(0, 10)}
              </p>
            </>
          ) : (
            <>
              <p className="font-serif-metric" style={{ color: 'var(--muted-2)' }}>—</p>
              <p className="font-sans-body">Appears after your first launch.</p>
            </>
          )}
        </div>

        <div className="card">
          <p className="font-mono-label">AI Visibility</p>
          {mentionRate != null ? (
            <>
              <p className="font-serif-metric">{mentionRate}%</p>
              <p className="font-mono-micro">of AI answers mention you · last 30 days · {checks.length} checks</p>
            </>
          ) : (
            <>
              <p className="font-serif-metric" style={{ color: 'var(--muted-2)' }}>—</p>
              <p className="font-sans-body">Tracking begins after your first launch.</p>
            </>
          )}
        </div>

        <div className="card">
          <p className="font-mono-label">Live listings</p>
          {submissionCount ? (
            <>
              <p className="font-serif-metric">{liveCount ?? 0}</p>
              <p className="font-mono-micro">live or indexed · of {submissionCount} submissions</p>
            </>
          ) : (
            <>
              <p className="font-serif-metric" style={{ color: 'var(--muted-2)' }}>—</p>
              <p className="font-sans-body">Your listings appear here after your first launch.</p>
            </>
          )}
        </div>
      </div>

      {/* 90-day trend — the shared chart renders an honest placeholder under 2 points */}
      <div className="card">
        <p className="font-mono-label" style={{ marginBottom: 'var(--space-md)' }}>
          Distribution Score · 90 days
        </p>
        <TrendChart points={trendPoints} />
      </div>

      {(notifications ?? []).length > 0 && (
        <div className="card card--dense">
          <p className="font-mono-label" style={{ marginBottom: 'var(--space-md)' }}>
            Notifications
          </p>
          {(notifications ?? []).map((n) => (
            <div
              key={n.id}
              style={{
                opacity: n.read ? 0.5 : 1,
                borderTop: '1px solid var(--border)',
                padding: 'var(--space-sm) 0',
              }}
            >
              <p className="font-sans-label">{n.title}</p>
              {n.body && <p className="font-mono-micro">{n.body}</p>}
            </div>
          ))}
        </div>
      )}

      <div className="card card--dense">
        <p className="font-mono-label" style={{ marginBottom: 'var(--space-md)' }}>
          Recent activity
        </p>
        {recent && recent.length > 0 ? (
          <table className="w-full" style={{ borderCollapse: 'collapse' }}>
            <tbody>
              {recent.map((s, i) => (
                <tr key={i} style={{ borderTop: '1px solid var(--border)' }}>
                  <td className="font-mono-data" style={{ padding: 'var(--space-sm) 0' }}>
                    {s.platform_id}
                  </td>
                  <td>
                    <span
                      className={
                        ['live', 'indexed'].includes(s.status)
                          ? 'status-live'
                          : ['failed', 'removed'].includes(s.status)
                            ? 'status-dead'
                            : 'status-pending'
                      }
                    >
                      {s.status}
                    </span>
                  </td>
                  <td className="font-mono-micro" style={{ textAlign: 'right' }}>
                    {new Date(s.created_at).toISOString().slice(0, 10)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="font-sans-body">
            Your product is built. Now get it found — install the extension and run your first
            launch.
          </p>
        )}
      </div>
    </div>
  )
}
