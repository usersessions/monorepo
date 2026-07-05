import { NextResponse } from 'next/server'
import { authenticateBearer } from '@/lib/auth/bearer'
import { createServiceClient } from '@/lib/supabase/server'
import { computeDistributionScore } from '@/lib/distribution-score'
import { limitsFor, monthStartIso } from '@/lib/tiers'
import type { CampaignPayload, CampaignResponse, SubmissionStatus } from '@usersessions/shared'

/**
 * POST /api/campaigns — THE HEARTBEAT (EXECUTION_PLAN M7).
 * Extension → dashboard ingestion: upserts the campaign, inserts one submission per
 * PlatformResult, then recomputes the Distribution Score SYNCHRONOUSLY so the dashboard
 * feels instant. Enforces plan metering with the exact PLAN_LIMIT_EXCEEDED contract.
 */

const VALID_STATUSES: SubmissionStatus[] = [
  'submitted',
  'awaiting_email_verification',
  'live',
  'indexed',
  'failed',
  'removed',
]

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function bad(error: CampaignResponse['error'], status: number): NextResponse {
  return NextResponse.json({ ok: false, error } satisfies CampaignResponse, { status })
}

export async function POST(request: Request) {
  const user = await authenticateBearer(request)
  if (!user) return bad('UNAUTHORIZED', 401)

  let payload: CampaignPayload
  try {
    payload = (await request.json()) as CampaignPayload
  } catch {
    return bad('INVALID_PAYLOAD', 400)
  }

  if (
    !UUID_RE.test(payload?.campaignId ?? '') ||
    !UUID_RE.test(payload?.productId ?? '') ||
    !Array.isArray(payload.results) ||
    payload.results.length === 0 ||
    payload.results.some(
      (r) => typeof r.platformId !== 'string' || !VALID_STATUSES.includes(r.status)
    )
  ) {
    return bad('INVALID_PAYLOAD', 400)
  }

  const db = createServiceClient()
  const isSimulated = payload.results.every((r) => r.simulated)

  // ---- Product: verify ownership, or bootstrap it on first campaign ----
  const { data: product } = await db
    .from('products')
    .select('id,user_id')
    .eq('id', payload.productId)
    .maybeSingle()

  if (product && product.user_id !== user.id) return bad('UNAUTHORIZED', 403)

  const { data: profile } = await db
    .from('profiles')
    .select('plan')
    .eq('id', user.id)
    .single()
  const limits = limitsFor(profile?.plan)

  if (!product) {
    if (!payload.productName || !payload.productUrl) return bad('INVALID_PAYLOAD', 400)

    const { count: productCount } = await db
      .from('products')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
    if ((productCount ?? 0) >= limits.productSlots && !isSimulated) {
      return bad('PLAN_LIMIT_EXCEEDED', 403)
    }

    const { error: productError } = await db.from('products').insert({
      id: payload.productId,
      user_id: user.id,
      name: payload.productName.slice(0, 200),
      url: payload.productUrl.slice(0, 500),
    })
    if (productError) return bad('INVALID_PAYLOAD', 400)
  }

  // ---- Metering (simulated runs are always free — they exist for safe adapter testing) ----
  if (!isSimulated) {
    if (limits.lifetimeSubmissionCap !== null) {
      const { count: realSubs } = await db
        .from('submissions')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('simulated', false)
      if ((realSubs ?? 0) + payload.results.filter((r) => !r.simulated).length > limits.lifetimeSubmissionCap) {
        return bad('PLAN_LIMIT_EXCEEDED', 403)
      }
    }

    const { count: launchesThisMonth } = await db
      .from('campaigns')
      .select('*', { count: 'exact', head: true })
      .eq('product_id', payload.productId)
      .gte('started_at', monthStartIso())
    if ((launchesThisMonth ?? 0) >= limits.launchesPerProductPerMonth) {
      return bad('PLAN_LIMIT_EXCEEDED', 403)
    }
  }

  // ---- Campaign upsert ----
  const { error: campaignError } = await db.from('campaigns').upsert(
    {
      id: payload.campaignId,
      user_id: user.id,
      product_id: payload.productId,
      status: payload.finishedAt ? 'completed' : 'running',
      started_at: payload.startedAt,
      completed_at: payload.finishedAt ?? null,
    },
    { onConflict: 'id' }
  )
  if (campaignError) return bad('INVALID_PAYLOAD', 400)

  // ---- Submissions: one row per PlatformResult ----
  const { error: submissionsError } = await db.from('submissions').insert(
    payload.results.map((r) => ({
      campaign_id: payload.campaignId,
      user_id: user.id,
      platform_id: r.platformId,
      status: r.status,
      listing_url: r.listingUrl ?? null,
      screenshot_url: r.screenshotUrl ?? null,
      simulated: r.simulated,
    }))
  )
  if (submissionsError) {
    console.error('[campaigns] submissions insert failed:', submissionsError)
    return bad('INVALID_PAYLOAD', 400)
  }

  // ---- Synchronous score recompute: the dashboard must feel instant ----
  try {
    await computeDistributionScore(user.id, payload.productId)
  } catch (err) {
    // Score failure must not fail the ingest — the nightly cron (M9) will catch up.
    console.error('[campaigns] score recompute failed:', err)
  }

  return NextResponse.json({ ok: true, campaignId: payload.campaignId } satisfies CampaignResponse)
}
