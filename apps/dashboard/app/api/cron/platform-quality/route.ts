import { NextResponse } from 'next/server'
import { authorizeCron, logCron } from '@/lib/cron'
import { createServiceClient } from '@/lib/supabase/server'

export const maxDuration = 60

const LIVE = ['live', 'indexed']
const MIN_SAMPLE = 5 // below this, quality_score stays null and the UI keeps the labeled editorial estimate — never a fabricated number

/**
 * Platform Quality Score (BUILD_SPEC §10) — ONE NAME, EVERYWHERE.
 * Aggregated across ALL users, rolling 90 days, real submissions only:
 * quality = round(0.4*editorial + 0.4*survival*100 + 0.2*indexation*100)
 */
export async function GET(request: Request) {
  if (!authorizeCron(request)) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })

  const db = createServiceClient()
  const stats = { platforms: 0, computed: 0, insufficientSample: 0 }

  try {
    const since = new Date(Date.now() - 90 * 24 * 3600 * 1000).toISOString()
    const [{ data: platforms }, { data: subs }] = await Promise.all([
      db.from('platforms').select('id, editorial_score'),
      db
        .from('submissions')
        .select('platform_id, status')
        .eq('simulated', false)
        .gte('created_at', since),
    ])

    const byPlatform = new Map<string, { total: number; live: number; indexed: number }>()
    for (const s of subs ?? []) {
      const agg = byPlatform.get(s.platform_id) ?? { total: 0, live: 0, indexed: 0 }
      agg.total += 1
      if (LIVE.includes(s.status)) agg.live += 1
      if (s.status === 'indexed') agg.indexed += 1
      byPlatform.set(s.platform_id, agg)
    }

    for (const p of platforms ?? []) {
      stats.platforms++
      const agg = byPlatform.get(p.id)

      if (!agg || agg.total < MIN_SAMPLE) {
        stats.insufficientSample++
        continue // leave quality_score null — the labeled editorial estimate stays
      }

      const survival = agg.live / agg.total
      const indexation = agg.live > 0 ? agg.indexed / agg.live : 0
      const quality = Math.round(
        0.4 * Number(p.editorial_score ?? 0) + 0.4 * survival * 100 + 0.2 * indexation * 100
      )

      await db
        .from('platforms')
        .update({ quality_score: Math.max(0, Math.min(100, quality)) })
        .eq('id', p.id)
      stats.computed++
    }

    await logCron('platform-quality', 'ok', stats)
    return NextResponse.json({ ok: true, ...stats })
  } catch (err) {
    await logCron('platform-quality', 'failed', { error: String(err), ...stats })
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}
