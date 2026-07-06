import { requireAdmin } from '@/lib/admin'
import { createServiceClient } from '@/lib/supabase/server'

/**
 * Dogfood status (BUILD_SPEC §4): launch usersessions with usersessions.
 * We sell a product we use — this page makes that claim checkable, not aspirational.
 * Submissions run through the extension in a real browser session (by design,
 * BUILD_SPEC §1) — there is no server-side auto-submit, so this panel shows the
 * REAL state of our own campaign and exactly how to run it.
 */
export default async function AdminDogfoodPage() {
  await requireAdmin()
  const db = createServiceClient()

  const { data: products } = await db
    .from('products')
    .select('id, name, url, user_id, created_at')
    .ilike('url', '%usersessions.io%')

  const product = products?.[0] ?? null
  let campaignCount = 0
  let statusCounts: Record<string, number> = {}
  let latestScore: number | null = null

  if (product) {
    const [{ data: campaigns }, { data: scores }] = await Promise.all([
      db.from('campaigns').select('id').eq('product_id', product.id),
      db
        .from('distribution_scores')
        .select('score, computed_at')
        .eq('product_id', product.id)
        .order('computed_at', { ascending: false })
        .limit(1),
    ])
    campaignCount = campaigns?.length ?? 0
    latestScore = scores?.[0]?.score ?? null

    if (campaignCount > 0) {
      const { data: subs } = await db
        .from('submissions')
        .select('status')
        .in('campaign_id', (campaigns ?? []).map((c) => c.id))
      for (const s of subs ?? []) statusCounts[s.status] = (statusCounts[s.status] ?? 0) + 1
    }
  }

  return (
    <div className="flex flex-col" style={{ gap: 'var(--space-lg)', maxWidth: 720 }}>
      <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.75rem' }}>Dogfood</h1>
      <p className="font-sans-body">
        We sell a product we use. This is the live state of usersessions.io\u2019s own campaign — the permanent
        sample report and the Phase −1 gate.
      </p>

      {!product ? (
        <div className="card flex flex-col" style={{ gap: 'var(--space-sm)', borderColor: 'var(--amber)' }}>
          <p className="font-mono-label" style={{ color: 'var(--amber)' }}>Not started</p>
          <p className="font-sans-body">
            No usersessions.io product exists yet. Submissions run through the extension in a real browser
            session by design — run it once, from this admin account:
          </p>
          <ol className="font-sans-body" style={{ paddingLeft: 'var(--space-lg)', display: 'flex', flexDirection: 'column', gap: 'var(--space-xs)' }}>
            <li>1. Sign in on the dashboard with this account and keep the tab open (connects the extension).</li>
            <li>2. Open https://usersessions.io/home in a tab and click \u201cAnalyze this page\u201d in the extension.</li>
            <li>3. Generate copy, edit it until it sounds like us, approve.</li>
            <li>4. Launch. Handle any CAPTCHAs and email confirmations.</li>
            <li>5. Come back here — this panel fills in with the real results.</li>
          </ol>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3" style={{ gap: 'var(--space-md)' }}>
            {[
              { label: 'Campaigns run', value: campaignCount },
              { label: 'Distribution Score', value: latestScore ?? '—' },
              { label: 'Live listings', value: (statusCounts['live'] ?? 0) + (statusCounts['indexed'] ?? 0) },
            ].map((m) => (
              <div key={m.label} className="card card--dense">
                <p className="font-mono-label">{m.label}</p>
                <p className="font-serif-metric">{m.value}</p>
              </div>
            ))}
          </div>

          <div className="card card--dense">
            <p className="font-mono-label" style={{ marginBottom: 'var(--space-md)' }}>Submissions by status</p>
            {Object.keys(statusCounts).length === 0 ? (
              <p className="font-sans-body">Product exists but no campaign has run yet — launch one from the extension.</p>
            ) : (
              Object.entries(statusCounts).map(([status, count]) => (
                <div key={status} className="flex" style={{ gap: 'var(--space-md)', borderTop: '1px solid var(--border)', padding: 'var(--space-sm) 0' }}>
                  <span className={['live', 'indexed'].includes(status) ? 'status-live' : ['failed', 'removed'].includes(status) ? 'status-dead' : 'status-pending'}>
                    {status}
                  </span>
                  <span className="font-mono-data">{count}</span>
                </div>
              ))
            )}
          </div>
        </>
      )}
    </div>
  )
}
