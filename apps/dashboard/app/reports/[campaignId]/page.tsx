import { notFound } from 'next/navigation'
import { createServiceClient } from '@/lib/supabase/server'

/**
 * PUBLIC white-label distribution report (BUILD_SPEC §8): shareable without auth,
 * 404 for invalid ids, print-optimized — the browser's print-to-PDF IS the PDF feature.
 * Uses the service client because anonymous visitors have no session; the campaignId
 * (unguessable uuid) is the capability.
 */
export default async function ReportPage({
  params,
}: {
  params: Promise<{ campaignId: string }>
}) {
  const { campaignId } = await params
  if (!/^[0-9a-f-]{36}$/i.test(campaignId)) notFound()

  const db = createServiceClient()
  const { data: campaign } = await db
    .from('campaigns')
    .select('id, status, started_at, completed_at, product_id, products(name, url)')
    .eq('id', campaignId)
    .maybeSingle()
  if (!campaign) notFound()

  const [{ data: subs }, { data: platforms }, { data: before }, { data: after }] = await Promise.all([
    db.from('submissions').select('platform_id, status, listing_url, simulated').eq('campaign_id', campaignId),
    db.from('platforms').select('id, name, editorial_score, quality_score'),
    db
      .from('distribution_scores')
      .select('score')
      .eq('product_id', campaign.product_id)
      .lt('computed_at', campaign.started_at)
      .order('computed_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    db
      .from('distribution_scores')
      .select('score')
      .eq('product_id', campaign.product_id)
      .order('computed_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ])

  const platformById = new Map((platforms ?? []).map((p) => [p.id, p]))
  const product = (campaign.products as { name?: string; url?: string } | null)

  const badge = (status: string) =>
    ['live', 'indexed'].includes(status) ? 'status-live' : ['failed', 'removed'].includes(status) ? 'status-dead' : 'status-pending'

  return (
    <main style={{ maxWidth: 720, margin: '0 auto', padding: 'var(--space-xl)', display: 'flex', flexDirection: 'column', gap: 'var(--space-lg)' }}>
      {/* Print: white paper output for PDF export */}
      <style>{`@media print { html, body { background: #fff !important; color: #000 !important; } .card, .card--dense { border: 1px solid #ccc !important; background: #fff !important; } a { color: #000 !important; } }`}</style>

      <header>
        <span className="italic" style={{ fontFamily: 'var(--font-serif)', fontSize: '1.25rem' }}>usersessions</span>
        <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: '2rem', marginTop: 'var(--space-md)' }}>
          Distribution report — {product?.name ?? 'Untitled product'}
        </h1>
        {product?.url && <p className="font-mono-data">{product.url}</p>}
        <p className="font-mono-micro">
          campaign {campaign.id.slice(0, 8)} · {new Date(campaign.started_at).toISOString().slice(0, 10)} · generated{' '}
          {new Date().toISOString().slice(0, 10)}
        </p>
        {/* Agency branding plumbing (logo/accent from the owning profile) attaches here — upload UI ships with M11. */}
      </header>

      <div className="card card--dense flex" style={{ gap: 'var(--space-xl)' }}>
        <div>
          <p className="font-mono-label">Distribution Score before</p>
          <p className="font-serif-metric">{before?.score ?? '—'}</p>
        </div>
        <div>
          <p className="font-mono-label">after</p>
          <p className="font-serif-metric">{after?.score ?? '—'}</p>
        </div>
      </div>

      <div className="card card--dense">
        <p className="font-mono-label" style={{ marginBottom: 'var(--space-md)' }}>Platforms</p>
        {(subs ?? []).map((s, i) => {
          const p = platformById.get(s.platform_id)
          return (
            <div key={i} className="flex" style={{ gap: 'var(--space-md)', borderTop: '1px solid var(--border)', padding: 'var(--space-sm) 0' }}>
              <span className="font-mono-data" style={{ flex: 1 }}>
                {p?.name ?? s.platform_id}
                {s.simulated && <span className="font-mono-micro"> (simulated)</span>}
              </span>
              <span className="font-mono-data">{p?.quality_score ?? p?.editorial_score ?? '—'}</span>
              <span className={badge(s.status)}>{s.status}</span>
              {s.listing_url && (
                <a className="font-mono-micro" style={{ color: 'var(--primary)' }} href={s.listing_url}>{s.listing_url}</a>
              )}
            </div>
          )
        })}
      </div>

      <footer className="font-mono-micro">Get your product found — usersessions.io</footer>
    </main>
  )
}
