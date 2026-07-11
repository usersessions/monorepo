import { NextResponse } from 'next/server'
import { authenticateBearer } from '@/lib/auth/bearer'
import { createServiceClient } from '@/lib/supabase/server'
import { computeDistributionScore } from '@/lib/distribution-score'
import { limitsFor, monthStartIso } from '@/lib/tiers'
import { rateLimit } from '@/lib/rate-limit'
import { sendEmail } from '@/lib/email/resend'
import { ctaButton, dataTable, renderEmail, statusBadge } from '@/lib/email/template'
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

  // Abuse backstop: a legitimate extension run syncs a handful of times per
  // campaign; 30/min/user only trips on runaway retry loops or token abuse.
  if (!rateLimit(`campaigns:${user.id}`, 30, 60_000)) return bad('RATE_LIMITED', 429)

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
    // Reverse trial: free accounts get full live access for trialDays from signup…
    if (limits.trialDays !== null) {
      const signup = new Date(user.created_at).getTime()
      if (Number.isFinite(signup) && Date.now() - signup > limits.trialDays * 86_400_000) {
        return bad('PLAN_LIMIT_EXCEEDED', 403)
      }
    }
    // …and ONE full live launch (distinct live campaigns, current campaign excluded).
    if (limits.lifetimeLaunchCap !== null) {
      const { data: liveSubs } = await db
        .from('submissions')
        .select('campaign_id')
        .eq('user_id', user.id)
        .eq('simulated', false)
        .neq('campaign_id', payload.campaignId)
        .limit(500)
      const liveCampaigns = new Set((liveSubs ?? []).map((s) => s.campaign_id)).size
      if (liveCampaigns >= limits.lifetimeLaunchCap) return bad('PLAN_LIMIT_EXCEEDED', 403)
    }
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

    // Usage-limit warning: fire once when this launch crosses 80% of the monthly quota.
    const usedPct = ((launchesThisMonth ?? 0) + 1) / limits.launchesPerProductPerMonth
    if (usedPct >= 0.8) {
      const { data: emailProfile } = await db.from('profiles').select('email').eq('id', user.id).maybeSingle()
      if (emailProfile?.email) {
        void sendEmail({
          to: emailProfile.email,
          subject: 'Approaching your monthly launch limit',
          html: renderEmail({
            title: 'Approaching your limit',
            heroTitle: 'Approaching your launch limit',
            heroSubtitle: `You're using ${Math.round(usedPct * 100)}% of this product's monthly launches.`,
            bodyHtml: dataTable([
              ['Used', String((launchesThisMonth ?? 0) + 1)],
              ['Limit', String(limits.launchesPerProductPerMonth)],
              ['Resets', new Date(new Date(monthStartIso()).setUTCMonth(new Date(monthStartIso()).getUTCMonth() + 1)).toISOString().slice(0, 10)],
            ]),
            cta: { label: 'Upgrade plan', href: `${process.env.NEXT_PUBLIC_SITE_URL ?? 'https://usersessions.io'}/pricing` },
          }),
        })
      }
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
    payload.results.map((r) => {
      // Surface submissions carry platformId as "surface:<uuid>" — split it out so the
      // dedicated surface_id + surface_status columns are populated, and keep platform_id null.
      const isSurface = typeof r.platformId === 'string' && r.platformId.startsWith('surface:')
      const surfaceId = isSurface ? r.platformId.slice('surface:'.length) : null
      return {
        campaign_id: payload.campaignId,
        user_id: user.id,
        platform_id: isSurface ? null : r.platformId,
        surface_id: surfaceId,
        surface_status: isSurface ? (r.surfaceStatus ?? 'submitted') : null,
        status: r.status,
        listing_url: r.listingUrl ?? null,
        screenshot_url: r.screenshotUrl ?? null,
        simulated: r.simulated,
      }
    })
  )
  if (submissionsError) {
    console.error('[campaigns] submissions insert failed:', submissionsError)
    return bad('INVALID_PAYLOAD', 400)
  }

  // ---- Realtime notification: one summary row per synced campaign (toaster + /notifications) ----
  const emailPending = payload.results.filter((r) => r.status === 'awaiting_email_verification').length
  const failedCount = payload.results.filter((r) => r.status === 'failed').length
  const okCount = payload.results.length - failedCount
  const { error: notifyError } = await db.from('notifications').insert({
    user_id: user.id,
    kind: emailPending > 0 ? 'email_verification_needed' : 'campaign_synced',
    title: isSimulated
      ? `Simulation finished: ${okCount}/${payload.results.length} platforms filled`
      : `Campaign synced: ${okCount}/${payload.results.length} platforms submitted`,
    body:
      [
        failedCount > 0 ? `${failedCount} failed` : null,
        emailPending > 0 ? `${emailPending} awaiting email verification` : null,
      ]
        .filter(Boolean)
        .join(' · ') || null,
  })
  // Notification failure must not fail the ingest.
  if (notifyError) console.error('[campaigns] notification insert failed:', notifyError)

  // ---- Campaign completed email — design-system, fail-soft, mirrors the in-app notification ----
  if (payload.finishedAt) {
    const { data: emailProfile } = await db.from('profiles').select('email').eq('id', user.id).maybeSingle()
    if (emailProfile?.email) {
      const rows = payload.results.map(
        (r) =>
          [
            r.platformId,
            r.status === 'failed'
              ? statusBadge('dead', 'failed')
              : r.status === 'submitted' || r.status === 'live' || r.status === 'indexed'
                ? statusBadge('live', r.status)
                : statusBadge('pending', r.status.replaceAll('_', ' ')),
          ] as [string, string]
      )
      void sendEmail({
        to: emailProfile.email,
        subject: isSimulated ? 'Simulation finished' : 'Campaign complete',
        html: renderEmail({
          title: 'Campaign complete',
          heroTitle: isSimulated ? 'Simulation finished' : 'Campaign complete',
          heroSubtitle: `${okCount}/${payload.results.length} platforms ${isSimulated ? 'filled' : 'submitted'}.`,
          bodyHtml: dataTable(rows, ['Platform', 'Result']),
          cta: {
            label: 'View campaign',
            href: `${process.env.NEXT_PUBLIC_SITE_URL ?? 'https://usersessions.io'}/campaigns`,
          },
        }),
      })
    }
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
