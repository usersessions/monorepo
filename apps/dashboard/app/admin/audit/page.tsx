import { requireAdmin } from '@/lib/admin'
import { createServiceClient } from '@/lib/supabase/server'

/**
 * Append-only audit log browser (BUILD_SPEC §12). Read-only BY DESIGN:
 * no edit or delete affordances exist on this page, ever. Corrections are
 * new audit rows, never mutations of old ones.
 */
export default async function AdminAuditPage({
  searchParams,
}: {
  searchParams: Promise<{ action?: string }>
}) {
  await requireAdmin()
  const params = await searchParams
  const db = createServiceClient()

  let query = db
    .from('admin_audit_log')
    .select('id, admin_id, action, target_user_id, detail, created_at')
    .order('created_at', { ascending: false })
    .limit(100)
  if (params.action) query = query.eq('action', params.action)
  const { data: rows } = await query

  return (
    <div className="flex flex-col" style={{ gap: 'var(--space-lg)' }}>
      <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.75rem' }}>Audit log</h1>
      <p className="font-mono-micro">Append-only. Last 100 entries{params.action ? ` · action: ${params.action}` : ''}.</p>

      <form method="get" className="flex" style={{ gap: 'var(--space-sm)' }}>
        <input name="action" defaultValue={params.action ?? ''} placeholder="filter by action (exact)" className="input-field" style={{ maxWidth: 280 }} />
        <button className="btn-ghost" type="submit">Filter</button>
      </form>

      <div className="card card--dense">
        {!rows || rows.length === 0 ? (
          <p className="font-sans-body">No audit entries match.</p>
        ) : (
          rows.map((r) => (
            <div key={r.id} className="flex" style={{ gap: 'var(--space-md)', borderTop: '1px solid var(--border)', padding: 'var(--space-sm) 0', flexWrap: 'wrap' }}>
              <span className="font-mono-micro" style={{ width: 130 }}>
                {new Date(r.created_at).toISOString().replace('T', ' ').slice(0, 16)}
              </span>
              <span className="font-mono-data" style={{ minWidth: 200 }}>{r.action}</span>
              <span className="font-mono-micro" style={{ flex: 1 }}>
                admin {String(r.admin_id).slice(0, 8)}…
                {r.target_user_id ? ` → user ${String(r.target_user_id).slice(0, 8)}…` : ''}
              </span>
              {r.detail != null && (
                <span className="font-mono-micro" style={{ maxWidth: 360, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {JSON.stringify(r.detail)}
                </span>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  )
}
