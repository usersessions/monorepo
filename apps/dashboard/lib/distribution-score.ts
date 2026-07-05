import { createServiceClient } from './supabase/server'

const LIVE_STATUSES = ['live', 'indexed']

/**
 * Distribution Score (BUILD_SPEC §8) — plain function, called synchronously from
 * POST /api/campaigns (must feel instant) and from the nightly link-check cron.
 * score = round(coverage*40 + (avgQuality/100)*30 + survival*20 + indexation*10), clamped 0–100.
 * Appends to distribution_scores; never mutates history.
 */
export async function computeDistributionScore(
  userId: string,
  productId: string
): Promise<number | null> {
  const db = createServiceClient()

  const { count: totalActive } = await db
    .from('platforms')
    .select('*', { count: 'exact', head: true })
    .eq('active', true)

  const { data: campaigns } = await db.from('campaigns').select('id').eq('product_id', productId)
  const campaignIds = (campaigns ?? []).map((c) => c.id)
  if (campaignIds.length === 0) return null

  const { data: subs } = await db
    .from('submissions')
    .select('platform_id,status,created_at')
    .in('campaign_id', campaignIds)
  if (!subs || subs.length === 0) return null

  const live = subs.filter((s) => LIVE_STATUSES.includes(s.status))

  // coverage: distinct live platforms / active catalog
  const coverage = totalActive ? new Set(live.map((s) => s.platform_id)).size / totalActive : 0

  // survival: live / all submissions in a 30-day window
  const since = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString()
  const recent = subs.filter((s) => s.created_at >= since)
  const survival = recent.length
    ? recent.filter((s) => LIVE_STATUSES.includes(s.status)).length / recent.length
    : 0

  // indexation: indexed / (live + indexed)
  const indexedCount = subs.filter((s) => s.status === 'indexed').length
  const indexation = live.length ? indexedCount / live.length : 0

  // avg Platform Quality across live platforms (computed quality, else labeled editorial estimate)
  let avgQuality = 0
  const livePlatformIds = [...new Set(live.map((s) => s.platform_id))]
  if (livePlatformIds.length > 0) {
    const { data: plats } = await db
      .from('platforms')
      .select('id,quality_score,editorial_score')
      .in('id', livePlatformIds)
    const values = (plats ?? []).map((p) => Number(p.quality_score ?? p.editorial_score ?? 0))
    avgQuality = values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0
  }

  const score = Math.max(
    0,
    Math.min(100, Math.round(coverage * 40 + (avgQuality / 100) * 30 + survival * 20 + indexation * 10))
  )

  await db.from('distribution_scores').insert({
    user_id: userId,
    product_id: productId,
    score,
    platform_coverage: coverage,
    avg_platform_quality: avgQuality,
    link_survival_rate: survival,
    indexation_rate: indexation,
  })

  return score
}
