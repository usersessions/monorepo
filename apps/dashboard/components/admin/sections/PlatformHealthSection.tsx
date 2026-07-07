import { createServiceClient } from '@/lib/supabase/server'
import PlatformHealthCard, { type PlatformHealthRow } from '../PlatformHealthCard'

// Async server component: all active platforms with their latest health snapshot.
// Platforms without a snapshot yet render as 'maintenance' (grey) — never hidden.
export default async function PlatformHealthSection() {
  const db = createServiceClient()
  const [{ data: platforms }, { data: health }, { data: liveSubs }] = await Promise.all([
    db.from('platforms').select('id, name').eq('active', true).order('name'),
    db.from('platform_health').select('platform_id, status, last_check_at, avg_response_ms, error_rate, adapter_version').order('last_check_at', { ascending: false }).limit(500),
    db.from('submissions').select('platform_id').eq('status', 'live').limit(5000),
  ])

  const latest = new Map<string, NonNullable<typeof health>[number]>()
  for (const h of health ?? []) if (!latest.has(h.platform_id)) latest.set(h.platform_id, h)

  const liveCount = new Map<string, number>()
  for (const s of liveSubs ?? []) liveCount.set(s.platform_id, (liveCount.get(s.platform_id) ?? 0) + 1)

  const rows: PlatformHealthRow[] = (platforms ?? []).map((p) => {
    const h = latest.get(p.id)
    return {
      platformId: p.id,
      name: p.name,
      status: h?.status ?? 'maintenance',
      lastCheckAt: h?.last_check_at ?? null,
      avgResponseMs: h?.avg_response_ms ?? null,
      errorRate: h?.error_rate != null ? Number(h.error_rate) : null,
      adapterVersion: h?.adapter_version ?? null,
      liveSubmissions: liveCount.get(p.id) ?? 0,
    }
  })

  return (
    <section className="flex flex-col" style={{ gap: 'var(--space-md)' }}>
      <p className="font-mono-label">Platform health</p>
      <div className="grid grid-cols-2 lg:grid-cols-5" style={{ gap: 'var(--space-md)' }}>
        {rows.map((r) => (
          <PlatformHealthCard key={r.platformId} row={r} />
        ))}
      </div>
    </section>
  )
}
