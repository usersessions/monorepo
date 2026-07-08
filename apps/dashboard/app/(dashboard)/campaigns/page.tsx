import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'

interface SearchParams {
  status?: string
  product?: string
}

export default async function CampaignsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const params = await searchParams
  const supabase = await createClient()

  const [{ data: campaigns }, { data: subs }] = await Promise.all([
    supabase
      .from('campaigns')
      .select('id, status, started_at, completed_at, products(name)')
      .order('started_at', { ascending: false }),
    supabase.from('submissions').select('campaign_id, platform_id, status, listing_url, simulated'),
  ])

  const byCampaign = new Map<string, NonNullable<typeof subs>>()
  for (const s of subs ?? []) {
    const list = byCampaign.get(s.campaign_id) ?? []
    list.push(s)
    byCampaign.set(s.campaign_id, list)
  }

  const badge = (status: string) =>
    ['live', 'indexed'].includes(status)
      ? 'status-live'
      : ['failed', 'removed'].includes(status)
        ? 'status-dead'
        : status === 'running'
          ? 'status-running'
          : 'status-pending'

  const productOf = (c: NonNullable<typeof campaigns>[number]) =>
    (c.products as { name?: string } | null)?.name ?? 'Untitled product'

  // Filter options derive from real data — no hardcoded status lists.
  const statuses = [...new Set((campaigns ?? []).map((c) => c.status))].sort()
  const productNames = [...new Set((campaigns ?? []).map(productOf))].sort()

  const rows = (campaigns ?? []).filter((c) => {
    if (params.status && c.status !== params.status) return false
    if (params.product && productOf(c) !== params.product) return false
    return true
  })

  const filtered = Boolean(params.status || params.product)

  return (
    <div className="flex flex-col" style={{ gap: 'var(--space-lg)' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', flexWrap: 'wrap', gap: 'var(--space-sm)' }}>
        <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.75rem' }}>Campaigns</h1>
        {(campaigns ?? []).length > 0 && (
          <span className="font-mono-micro">
            {rows.length} of {(campaigns ?? []).length}
          </span>
        )}
      </div>

      {/* Filter bar — plain GET form, no client JS needed */}
      {(campaigns ?? []).length > 1 && (
        <form method="get" className="card card--dense flex" style={{ gap: 'var(--space-md)', alignItems: 'center', flexWrap: 'wrap' }}>
          <select name="status" defaultValue={params.status ?? ''} className="input-field" style={{ width: 'auto' }} aria-label="Filter by status">
            <option value="">all statuses</option>
            {statuses.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <select name="product" defaultValue={params.product ?? ''} className="input-field" style={{ width: 'auto' }} aria-label="Filter by product">
            <option value="">all products</option>
            {productNames.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
          <button className="btn-ghost" type="submit">Filter</button>
          {filtered && (
            <Link href="/campaigns" className="font-mono-micro" style={{ color: 'var(--primary)', textDecoration: 'none' }}>
              clear
            </Link>
          )}
        </form>
      )}

      {(campaigns ?? []).length === 0 ? (
        <div className="card">
          <p className="font-sans-body">
            No campaigns yet. Install the extension, approve your copy, and run your first launch.
          </p>
        </div>
      ) : rows.length === 0 ? (
        <div className="card">
          <p className="font-sans-body">
            No campaigns match these filters.{' '}
            <Link href="/campaigns" style={{ color: 'var(--primary)' }}>Clear filters</Link>
          </p>
        </div>
      ) : (
        rows.map((c) => {
          const rowsFor = byCampaign.get(c.id) ?? []
          const product = productOf(c)
          return (
            <details key={c.id} className="card card--dense">
              <summary
                className="flex items-center"
                style={{ gap: 'var(--space-md)', cursor: 'pointer', listStyle: 'none' }}
              >
                <span className="font-sans-label" style={{ flex: 1 }}>{product}</span>
                <span className="font-mono-micro">{new Date(c.started_at).toISOString().slice(0, 10)}</span>
                <span className={badge(c.status)}>{c.status}</span>
                <span className="font-mono-data">
                  {rowsFor.filter((r) => ['live', 'indexed', 'submitted'].includes(r.status)).length}/{rowsFor.length}
                </span>
              </summary>

              <div style={{ marginTop: 'var(--space-md)', display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
                {rowsFor.map((r, i) => (
                  <div key={i} className="flex items-center" style={{ gap: 'var(--space-md)', borderTop: '1px solid var(--border)', paddingTop: 'var(--space-sm)' }}>
                    <span className="font-mono-data" style={{ flex: 1 }}>
                      {r.platform_id}
                      {r.simulated && <span className="font-mono-micro"> (simulated)</span>}
                    </span>
                    <span className={badge(r.status)}>{r.status}</span>
                    {r.listing_url && (
                      <a className="font-mono-micro" style={{ color: 'var(--primary)' }} href={r.listing_url} target="_blank" rel="noreferrer">
                        listing ↗
                      </a>
                    )}
                  </div>
                ))}
                <Link className="font-mono-micro" style={{ color: 'var(--primary)' }} href={`/reports/${c.id}`} target="_blank">
                  Download report ↗
                </Link>
              </div>
            </details>
          )
        })
      )}
    </div>
  )
}
