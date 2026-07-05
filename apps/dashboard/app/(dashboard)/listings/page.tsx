import { createClient } from '@/lib/supabase/server'
import { queueResubmission } from './actions'

interface SearchParams {
  status?: string
  category?: string
  q?: string
}

export default async function ListingsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const params = await searchParams
  const supabase = await createClient()

  const [{ data: subs }, { data: platforms }] = await Promise.all([
    supabase
      .from('submissions')
      .select('id, platform_id, status, listing_url, simulated, created_at')
      .order('created_at', { ascending: false }),
    supabase.from('platforms').select('id, name, category, editorial_score, quality_score'),
  ])

  const platformById = new Map((platforms ?? []).map((p) => [p.id, p]))

  const rows = (subs ?? []).filter((s) => {
    const p = platformById.get(s.platform_id)
    if (params.status && s.status !== params.status) return false
    if (params.category && p?.category !== params.category) return false
    if (params.q && !(p?.name ?? s.platform_id).toLowerCase().includes(params.q.toLowerCase())) return false
    return true
  })

  const badge = (status: string) =>
    ['live', 'indexed'].includes(status)
      ? 'status-live'
      : ['failed', 'removed'].includes(status)
        ? 'status-dead'
        : 'status-pending'

  return (
    <div className="flex flex-col" style={{ gap: 'var(--space-lg)' }}>
      <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.75rem' }}>Listings</h1>

      {/* Filter bar — plain GET form, no client JS needed */}
      <form method="get" className="card card--dense flex" style={{ gap: 'var(--space-md)', alignItems: 'center', flexWrap: 'wrap' }}>
        <select name="status" defaultValue={params.status ?? ''} className="input-field" style={{ width: 'auto' }}>
          <option value="">all statuses</option>
          {['submitted', 'awaiting_email_verification', 'live', 'indexed', 'failed', 'removed'].map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <select name="category" defaultValue={params.category ?? ''} className="input-field" style={{ width: 'auto' }}>
          <option value="">all categories</option>
          {['ai', 'startup', 'saas', 'dev'].map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        <input name="q" defaultValue={params.q ?? ''} placeholder="search platform" className="input-field" style={{ width: 180 }} />
        <button className="btn-ghost" type="submit">Filter</button>
      </form>

      <div className="card card--dense">
        {rows.length === 0 ? (
          <p className="font-sans-body">No listings match. Run a launch and they appear here.</p>
        ) : (
          <table className="w-full" style={{ borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['Platform', 'Quality', 'Status', 'Listing', 'Submitted', ''].map((h) => (
                  <th key={h} className="font-mono-label" style={{ textAlign: 'left', paddingBottom: 'var(--space-sm)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((s) => {
                const p = platformById.get(s.platform_id)
                const quality = p?.quality_score ?? p?.editorial_score
                return (
                  <tr key={s.id} style={{ borderTop: '1px solid var(--border)' }}>
                    <td className="font-mono-data" style={{ padding: 'var(--space-sm) 0' }}>
                      {p?.name ?? s.platform_id}
                      {s.simulated && <span className="font-mono-micro"> (simulated)</span>}
                    </td>
                    <td className="font-mono-data">
                      {quality ?? '—'}
                      {p && p.quality_score == null && p.editorial_score != null && (
                        <span className="font-mono-micro"> est.</span>
                      )}
                    </td>
                    <td><span className={badge(s.status)}>{s.status}</span></td>
                    <td>
                      {s.listing_url ? (
                        <a className="font-mono-micro" style={{ color: 'var(--primary)' }} href={s.listing_url} target="_blank" rel="noreferrer">open ↗</a>
                      ) : (
                        <span className="font-mono-micro">—</span>
                      )}
                      {s.status === 'awaiting_email_verification' && (
                        <span className="font-mono-micro" style={{ color: 'var(--amber)' }}> confirm via email</span>
                      )}
                    </td>
                    <td className="font-mono-micro">{new Date(s.created_at).toISOString().slice(0, 10)}</td>
                    <td>
                      {['failed', 'removed'].includes(s.status) && (
                        <form action={queueResubmission}>
                          <input type="hidden" name="submissionId" value={s.id} />
                          <input type="hidden" name="platformId" value={s.platform_id} />
                          <button className="btn-ghost" type="submit">Resubmit</button>
                        </form>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
