import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { limitsFor, monthStartIso } from '@/lib/tiers'
import { rateLimit } from '@/lib/rate-limit'
import { trackFeatureServer } from '@/lib/tracking'
import type { ReviewCampaignResponse, ReviewRecipientInput } from '@usersessions/shared'

/**
 * POST /api/reviews/campaign — create a review-REQUEST campaign for a founder's own activated
 * users and AI-draft one personalized, honest email per recipient (edited + sent separately).
 * Metered per plan. We never fake, gate, or incentivize reviews; the copy only asks.
 */

export const maxDuration = 60

const GEMINI_MODEL = process.env.GEMINI_MODEL ?? 'gemini-2.5-flash'
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`

function bad(error: ReviewCampaignResponse['error'], status: number): NextResponse {
  return NextResponse.json({ ok: false, error } satisfies ReviewCampaignResponse, { status })
}

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/

async function draftEmail(
  key: string,
  productName: string,
  platformName: string,
  reviewUrl: string,
  r: ReviewRecipientInput
): Promise<{ subject: string; body: string }> {
  const fallback = {
    subject: `Quick favor about ${productName}?`,
    body: `Hi ${r.name ?? 'there'},\n\nThanks for using ${productName}. If it has been useful, an honest review on ${platformName} would genuinely help other founders find it: ${reviewUrl}\n\nEither way, thank you for being an early user.`,
  }
  const prompt = [
    'Write a short, warm, HONEST review-request email from a founder to a real user.',
    'Rules: ask for an honest review (never a positive one), no incentives, no pressure, no hype words.',
    r.activationEvent ? `Reference this thing the user actually did: "${r.activationEvent}".` : '',
    `Product: ${productName}. Review platform: ${platformName}. Review link: ${reviewUrl}.`,
    `Recipient name: ${r.name ?? '(unknown)'}.`,
    'Respond ONLY as JSON: {"subject":"...","body":"..."} (body is plain text, max 6 sentences).',
  ].join('\n')
  try {
    const res = await fetch(GEMINI_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: 'application/json', temperature: 0.6 },
      }),
      signal: AbortSignal.timeout(12_000),
    })
    if (!res.ok) return fallback
    const payload = await res.json()
    const parsed = JSON.parse(payload?.candidates?.[0]?.content?.parts?.[0]?.text ?? '{}')
    return {
      subject: String(parsed.subject ?? fallback.subject).slice(0, 160),
      body: String(parsed.body ?? fallback.body).slice(0, 1200),
    }
  } catch {
    return fallback
  }
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return bad('UNAUTHORIZED', 401)
  if (!rateLimit(`reviewcampaign:${user.id}`, 5, 60_000)) return bad('RATE_LIMITED', 429)
  trackFeatureServer(user.id, 'review_campaign_create', 'generate')

  let body: { productId?: unknown; platformId?: unknown; recipients?: unknown }
  try {
    body = await request.json()
  } catch {
    return bad('INVALID_PAYLOAD', 400)
  }
  const productId = typeof body.productId === 'string' ? body.productId : ''
  const platformId = typeof body.platformId === 'string' ? body.platformId : ''
  const recipientsRaw = Array.isArray(body.recipients) ? body.recipients : []
  if (!productId || !platformId || recipientsRaw.length === 0) return bad('INVALID_PAYLOAD', 400)

  const db = createServiceClient()
  const { data: product } = await db.from('products').select('id, user_id, name').eq('id', productId).maybeSingle()
  if (!product || product.user_id !== user.id) return bad('UNAUTHORIZED', 403)

  const { data: profile } = await db.from('profiles').select('plan').eq('id', user.id).maybeSingle()
  const limits = limitsFor(profile?.plan)
  if (limits.reviewCampaignsPerMonth === 0) return bad('PLAN_LIMIT_EXCEEDED', 403)

  // Monthly campaign cap.
  if (limits.reviewCampaignsPerMonth !== null) {
    const { count } = await db
      .from('review_campaigns')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .gte('created_at', monthStartIso())
    if ((count ?? 0) >= limits.reviewCampaignsPerMonth) return bad('PLAN_LIMIT_EXCEEDED', 403)
  }

  // Validate + clamp recipients to the per-campaign cap.
  const recipients: ReviewRecipientInput[] = recipientsRaw
    .filter((r: unknown): r is Record<string, unknown> => typeof r === 'object' && r !== null)
    .map((r) => ({
      email: String(r.email ?? '').trim().toLowerCase(),
      name: r.name ? String(r.name).slice(0, 120) : undefined,
      activationEvent: r.activationEvent ? String(r.activationEvent).slice(0, 200) : undefined,
    }))
    .filter((r) => EMAIL_RE.test(r.email))
    .slice(0, limits.reviewRequestsPerCampaign)
  if (recipients.length === 0) return bad('INVALID_PAYLOAD', 400)

  const { data: platform } = await db
    .from('review_platforms')
    .select('name, url')
    .eq('id', platformId)
    .maybeSingle()
  if (!platform) return bad('INVALID_PAYLOAD', 400)

  // Create the campaign.
  const { data: campaign, error: campErr } = await db
    .from('review_campaigns')
    .insert({ product_id: productId, user_id: user.id, status: 'draft' })
    .select('id')
    .single()
  if (campErr || !campaign) return bad('INVALID_PAYLOAD', 400)

  const key = process.env.GEMINI_API_KEY
  const drafts: NonNullable<ReviewCampaignResponse['drafts']> = []
  for (const r of recipients) {
    const email = key
      ? await draftEmail(key, product.name, platform.name, platform.url, r)
      : {
          subject: `Quick favor about ${product.name}?`,
          body: `Hi ${r.name ?? 'there'},\n\nThanks for using ${product.name}. If it has been useful, an honest review on ${platform.name} would help other founders find it: ${platform.url}\n\nThank you for being an early user.`,
        }
    const { data: reqRow } = await db
      .from('review_requests')
      .insert({
        review_campaign_id: campaign.id,
        user_id: user.id,
        recipient_email: r.email,
        recipient_name: r.name ?? null,
        activation_event: r.activationEvent ?? null,
        platform_id: platformId,
        subject: email.subject,
        body: email.body,
        status: 'draft',
      })
      .select('id')
      .single()
    if (reqRow) {
      drafts.push({
        requestId: reqRow.id,
        recipientEmail: r.email,
        recipientName: r.name ?? null,
        subject: email.subject,
        body: email.body,
      })
    }
  }

  return NextResponse.json({ ok: true, campaignId: campaign.id, drafts } satisfies ReviewCampaignResponse)
}
