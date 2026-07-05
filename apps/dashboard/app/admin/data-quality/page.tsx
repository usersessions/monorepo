import { requireAdmin } from '@/lib/admin'
import { createServiceClient } from '@/lib/supabase/server'

/**
 * Browse edits_telemetry to spot what humans consistently change about the AI's copy —
 * the quiet copy-quality moat (BUILD_SPEC §12).
 */
export default async function AdminDataQualityPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; edited?: string }>
}) {
  await requireAdmin()
  const { category, edited } = await searchParams
  const db = createServiceClient()

  let query = db
    .from('edits_telemetry')
    .select('platform_category, original_hook, edited_hook, original_body, edited_body, was_edited, created_at')
    .order('created_at', { ascending: false })
    .limit(50)
  if (category) query = query.eq('platform_category', category)
  if (edited === 'true') query = query.eq('was_edited', true)
  if (edited === 'false') query = query.eq('was_edited', false)
  const { data: rows } = await query

  return (
    <div className="flex flex-col" style={{ gap: 'var(--space-lg)' }}>
      <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.75rem' }}>Data quality</h1>

      <form method="get" className="flex" style={{ gap: 'var(--space-sm)' }}>
        <select name="category" defaultValue={category ?? ''} className="input-field" style={{ width: 'auto' }}>
          <option value="">all categories</option>
          {['ai', 'startup', 'saas', 'dev'].map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select name="edited" defaultValue={edited ?? ''} className="input-field" style={{ width: 'auto' }}>
          <option value="">edited + unedited</option>
          <option value="true">edited only</option>
          <option value="false">unedited only</option>
        </select>
        <button className="btn-ghost" type="submit">Filter</button>
      </form>

      <div className="card card--dense">
        {(rows ?? []).length === 0 ? (
          <p className="font-sans-body">No telemetry yet — it accumulates as users approve copy.</p>
        ) : (
          (rows ?? []).map((r, i) => (
            <div key={i} style={{ borderTop: '1px solid var(--border)', padding: 'var(--space-md) 0' }}>
              <div className="flex" style={{ gap: 'var(--space-md)' }}>
                <span className="font-mono-micro">{r.platform_category}</span>
                <span className={r.was_edited ? 'status-pending' : 'status-live'}>
                  {r.was_edited ? 'edited' : 'kept as generated'}
                </span>
                <span className="font-mono-micro">{new Date(r.created_at).toISOString().slice(0, 10)}</span>
              </div>
              {r.was_edited && (
                <div style={{ marginTop: 'var(--space-sm)' }}>
                  <p className="font-mono-micro" style={{ color: 'var(--muted-2)' }}>AI: {r.original_hook}</p>
                  <p className="font-mono-micro" style={{ color: 'var(--paper)' }}>Human: {r.edited_hook ?? r.original_hook}</p>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  )
}
