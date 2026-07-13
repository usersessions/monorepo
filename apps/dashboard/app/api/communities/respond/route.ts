import { NextResponse } from 'next/server'
import { authenticateBearer } from '@/lib/auth/bearer'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { limitsFor, monthStartIso } from '@/lib/tiers'
import { rateLimit } from '@/lib/rate-limit'
import { trackFeatureServer } from '@/lib/tracking-server'
import type { CommunityRespondResponse } from '@usersessions/shared'

/**
 * POST /api/communities/respond — draft (AI) or save/finalize a community response.
 * Two modes:
 *  - { opportunityId } only  → AI drafts an honest, non-promotional reply (metered).
 *  - { opportunityId, finalResponse, posted } → save the founder's edited reply / mark posted.
 * Honest: the draft is a genuinely helpful answer that mentions the product only if relevant.
 */

export const maxDuration = 30

const GEMINI_MODEL = process.env.GEMINI_MODEL ?? 'gemini-2.5-flash'
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`

function bad(error: CommunityRespondResponse['error'], status: number): NextResponse {
  return NextResponse.json({ ok: false, error } satisfies CommunityRespondResponse, { status })
}

export async function POST(request: Request) {
  const supabase = await createClient()
  let {
    data: { user },
  } = await supabase.auth.getUser()
  // Also accept the extension's Bearer token (in-tab “mark as responded” flow).
  if (!user) user = await authenticateBearer(request)
  if (!user) return bad('UNAUTHORIZED', 401)
  if (!rateLimit(`community:${user.id}`, 20, 60_000)) return bad('RATE_LIMITED', 429)
  trackFeatureServer(user.id, 'community_response_draft', 'generate')

  let body: { opportunityId?: unknown; finalResponse?: unknown; posted?: unknown }
  try {
    body = await request.json()
  } catch {
    return bad('INVALID_PAYLOAD', 400)
  }
  const opportunityId = typeof body.opportunityId === 'string' ? body.opportunityId : ''
  if (!opportunityId) return bad('INVALID_PAYLOAD', 400)

  // Opportunity + ownership. RLS scopes the session read; for Bearer callers the service
  // client reads and we enforce user_id ownership explicitly.
  const { data: opp } = await createServiceClient()
    .from('community_opportunities')
    .select('id, user_id, product_id, title, content_snippet, url, products(name, url)')
    .eq('id', opportunityId)
    .maybeSingle()
  if (!opp || opp.user_id !== user.id) return bad('UNAUTHORIZED', 403)
  const product = opp.products as { name?: string; url?: string } | null

  const db = createServiceClient()

  // ----- Save / finalize mode -----
  if (typeof body.finalResponse === 'string') {
    const final = body.finalResponse.slice(0, 4000)
    const posted = body.posted === true
    const { data: existing } = await db
      .from('community_responses')
      .select('id')
      .eq('opportunity_id', opportunityId)
      .maybeSingle()
    if (existing) {
      await db
        .from('community_responses')
        .update({ final_response: final, ...(posted ? { posted_at: new Date().toISOString() } : {}) })
        .eq('id', existing.id)
    } else {
      await db.from('community_responses').insert({
        opportunity_id: opportunityId,
        product_id: opp.product_id,
        user_id: user.id,
        draft_response: final,
        final_response: final,
        ...(posted ? { posted_at: new Date().toISOString() } : {}),
      })
    }
    await db
      .from('community_opportunities')
      .update({ status: posted ? 'responded' : 'approved' })
      .eq('id', opportunityId)
    return NextResponse.json({ ok: true } satisfies CommunityRespondResponse)
  }

  // ----- AI draft mode (metered) -----
  const { data: profile } = await db.from('profiles').select('plan').eq('id', user.id).maybeSingle()
  const limits = limitsFor(profile?.plan)
  if (limits.communityResponsesPerMonth === 0) return bad('PLAN_LIMIT_EXCEEDED', 403)
  if (limits.communityResponsesPerMonth !== null) {
    const { count } = await db
      .from('community_responses')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .gte('created_at', monthStartIso())
    if ((count ?? 0) >= limits.communityResponsesPerMonth) return bad('PLAN_LIMIT_EXCEEDED', 403)
  }

  const key = process.env.GEMINI_API_KEY
  if (!key) return bad('AI_NOT_CONFIGURED', 503)

  const prompt = [
    'Draft an HONEST, genuinely helpful reply to the community post below, in the founder\'s voice.',
    'Hard rules: be useful FIRST; answer the actual question. Mention the product ONLY if it is',
    'genuinely relevant, once, with clear disclosure that you built it. No marketing speak, no',
    'hype words, no links unless directly helpful. If the product is not relevant, do not mention it.',
    '',
    `Post title: ${opp.title}`,
    opp.content_snippet ? `Post content: ${opp.content_snippet}` : '',
    `Your product (only mention if relevant): ${product?.name ?? 'n/a'} (${product?.url ?? ''}).`,
    '',
    'Respond with ONLY the reply text, no preamble.',
  ].join('\n')

  try {
    const res = await fetch(GEMINI_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0.6 } }),
      signal: AbortSignal.timeout(15_000),
    })
    if (!res.ok) return bad('GENERATION_FAILED', 502)
    const payload = await res.json()
    const draft = String(payload?.candidates?.[0]?.content?.parts?.[0]?.text ?? '').trim().slice(0, 4000)
    if (!draft) return bad('GENERATION_FAILED', 502)

    const { data: row } = await db
      .from('community_responses')
      .insert({ opportunity_id: opportunityId, product_id: opp.product_id, user_id: user.id, draft_response: draft })
      .select('id')
      .single()
    await db.from('community_opportunities').update({ status: 'approved' }).eq('id', opportunityId)
    return NextResponse.json({ ok: true, responseId: row?.id, draftResponse: draft } satisfies CommunityRespondResponse)
  } catch (err) {
    console.error('[communities/respond] failed:', err)
    return bad('GENERATION_FAILED', 502)
  }
}
