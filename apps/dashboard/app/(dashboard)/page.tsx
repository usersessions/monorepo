import { createClient } from '@/lib/supabase/server'

const STEPS = ['Install', 'Launch', 'Watch'] as const // verbatim StoryBrand plan — BUILD_SPEC §2

export default async function OverviewPage() {
  const supabase = await createClient()

  const [{ count: campaignCount }, { count: submissionCount }, { data: latestScore }, { data: recent }] =
    await Promise.all([
      supabase.from('campaigns').select('*', { count: 'exact', head: true }),
      supabase.from('submissions').select('*', { count: 'exact', head: true }),
      supabase
        .from('distribution_scores')
        .select('score, computed_at')
        .order('computed_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from('submissions')
        .select('platform_id, status, created_at')
        .order('created_at', { ascending: false })
        .limit(10),
    ])

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

      <div className="grid grid-cols-1 md:grid-cols-2" style={{ gap: 'var(--space-lg)' }}>
        <div className="card">
          <p className="font-mono-label">Distribution Score</p>
          {latestScore ? (
            <p className="font-serif-metric">{latestScore.score}</p>
          ) : (
            <>
              <p className="font-serif-metric" style={{ color: 'var(--muted-2)' }}>—</p>
              <p className="font-sans-body">Appears after your first launch.</p>
            </>
          )}
        </div>
        <div className="card">
          <p className="font-mono-label">AI Visibility Score</p>
          <p className="font-serif-metric" style={{ color: 'var(--muted-2)' }}>—</p>
          <p className="font-sans-body">Tracking begins after your first launch.</p>
        </div>
      </div>

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
