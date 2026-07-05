import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'

export default async function CampaignsPage() {
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

  return (
    <div className="flex flex-col" style={{ gap: 'var(--space-lg)' }}>
      <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.75rem' }}>Campaigns</h1>

      {(campaigns ?? []).length === 0 ? (
        <div className="card">
          <p className="font-sans-body">
            No campaigns yet. Install the extension, approve your copy, and run your first launch.
          </p>
        </div>
      ) : (
        (campaigns ?? []).map((c) => {
          const rows = byCampaign.get(c.id) ?? []
          const product = (c.products as { name?: string } | null)?.name ?? 'Untitled product'
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
                  {rows.filter((r) => ['live', 'indexed', 'submitted'].includes(r.status)).length}/{rows.length}
                </span>
              </summary>

              <div style={{ marginTop: 'var(--space-md)', display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
                {rows.map((r, i) => (
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
