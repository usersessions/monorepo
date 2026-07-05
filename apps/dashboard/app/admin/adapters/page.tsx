import { requireAdmin } from '@/lib/admin'
import { createServiceClient } from '@/lib/supabase/server'
import { reviewAdapterRun } from '../actions'

export default async function AdminAdaptersPage() {
  await requireAdmin()
  const db = createServiceClient()
  const { data: runs } = await db
    .from('adapter_runs')
    .select('*')
    .eq('status', 'pending_review')
    .order('created_at', { ascending: true })

  return (
    <div className="flex flex-col" style={{ gap: 'var(--space-lg)' }}>
      <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.75rem' }}>Adapter review queue</h1>
      <p className="font-sans-body">
        Approving stages a 10% rollout and records you as reviewer. The rollout mechanics run
        extension-side; this queue is the human gate.
      </p>

      {(runs ?? []).length === 0 ? (
        <div className="card"><p className="font-sans-body">Nothing pending review.</p></div>
      ) : (
        (runs ?? []).map((run) => (
          <details key={run.id} className="card card--dense">
            <summary className="flex items-center" style={{ gap: 'var(--space-md)', cursor: 'pointer', listStyle: 'none' }}>
              <span className="font-mono-data" style={{ flex: 1 }}>{run.platform_id}</span>
              <span className="font-mono-micro">{run.run_type}</span>
              <span className="status-pending">pending review</span>
              <span className="font-mono-micro">{new Date(run.created_at).toISOString().slice(0, 10)}</span>
            </summary>

            <div style={{ marginTop: 'var(--space-md)', display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
              {run.dom_snapshot_url && (
                <a className="font-mono-micro" style={{ color: 'var(--primary)' }} href={run.dom_snapshot_url} target="_blank" rel="noreferrer">
                  DOM snapshot ↗
                </a>
              )}

              {run.proposed_diff && (
                <pre className="font-mono-micro" style={{ background: 'var(--ink)', border: '1px solid var(--border)', borderRadius: 'var(--rounded-sm)', padding: 'var(--space-md)', overflowX: 'auto', whiteSpace: 'pre-wrap' }}>
                  {run.proposed_diff}
                </pre>
              )}

              <div>
                <p className="font-mono-label" style={{ marginBottom: 'var(--space-sm)' }}>Canary batch results</p>
                {run.canary_results ? (
                  <pre className="font-mono-micro" style={{ whiteSpace: 'pre-wrap' }}>{JSON.stringify(run.canary_results, null, 2)}</pre>
                ) : (
                  <p className="font-mono-micro" style={{ color: 'var(--amber)' }}>
                    No canary results attached — per the canary gate, do not approve without them.
                  </p>
                )}
              </div>

              <div className="flex" style={{ gap: 'var(--space-md)' }}>
                <form action={reviewAdapterRun}>
                  <input type="hidden" name="runId" value={run.id} />
                  <input type="hidden" name="decision" value="approve" />
                  <button className="btn-primary" type="submit">Approve → Stage at 10%</button>
                </form>
                <form action={reviewAdapterRun}>
                  <input type="hidden" name="runId" value={run.id} />
                  <input type="hidden" name="decision" value="reject" />
                  <button className="btn-ghost" type="submit">Reject</button>
                </form>
              </div>
            </div>
          </details>
        ))
      )}
    </div>
  )
}
