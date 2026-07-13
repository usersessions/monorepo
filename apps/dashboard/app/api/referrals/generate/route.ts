import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { limitsFor, monthStartIso } from '@/lib/tiers'
import { rateLimit } from '@/lib/rate-limit'
import { trackFeatureServer } from '@/lib/tracking'
import type { ReferralGenerateResponse, ReferralProgramCopy, ReferralStructure } from '@usersessions/shared'

/**
 * POST /api/referrals/generate — AI suggests a referral structure + full copy set the founder
 * implements in their OWN product. Metered per plan. Honest: no fabricated metrics/claims.
 */

export const maxDuration = 30

const GEMINI_MODEL = process.env.GEMINI_MODEL ?? 'gemini-2.5-flash'
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`

const STRUCTURES: ReferralStructure[] = ['give_get', 'credits', 'discount', 'cash', 'tiered']

function bad(error: ReferralGenerateResponse['error'], status: number): NextResponse {
  return NextResponse.json({ ok: false, error } satisfies ReferralGenerateResponse, { status })
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return bad('UNAUTHORIZED', 401)
  if (!rateLimit(`referral:${user.id}`, 10, 60_000)) return bad('RATE_LIMITED', 429)
  trackFeatureServer(user.id, 'referral_program_generate', 'generate')

  let body: { productId?: unknown; category?: unknown; valueProp?: unknown; pricing?: unknown }
  try {
    body = await request.json()
  } catch {
    return bad('INVALID_PAYLOAD', 400)
  }
  const productId = typeof body.productId === 'string' ? body.productId : ''
  const category = typeof body.category === 'string' ? body.category.slice(0, 120) : ''
  const valueProp = typeof body.valueProp === 'string' ? body.valueProp.slice(0, 400) : ''
  const pricing = typeof body.pricing === 'string' ? body.pricing.slice(0, 200) : ''
  if (!productId) return bad('INVALID_PAYLOAD', 400)

  const db = createServiceClient()
  const { data: product } = await db.from('products').select('id, user_id, name, url').eq('id', productId).maybeSingle()
  if (!product || product.user_id !== user.id) return bad('UNAUTHORIZED', 403)

  const { data: profile } = await db.from('profiles').select('plan').eq('id', user.id).maybeSingle()
  const limits = limitsFor(profile?.plan)
  if (limits.referralProgramsPerMonth === 0) return bad('PLAN_LIMIT_EXCEEDED', 403)
  if (limits.referralProgramsPerMonth !== null) {
    const { count } = await db
      .from('referral_programs')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .gte('created_at', monthStartIso())
    if ((count ?? 0) >= limits.referralProgramsPerMonth) return bad('PLAN_LIMIT_EXCEEDED', 403)
  }

  const key = process.env.GEMINI_API_KEY
  if (!key) return bad('AI_NOT_CONFIGURED', 503)

  const prompt = [
    'You design a referral program for a software product and write the full copy set.',
    'First choose the best structure for the pricing model, one of:',
    'give_get (subscription: “give 1 month, get 1 month”), credits (usage-based: “unlock N credits”),',
    'discount, cash, or tiered.',
    'Then write honest, concrete copy — no fabricated numbers, no hype words (delve, seamless,',
    'leverage, game-changer, etc.), no “SEO”/“backlinks”.',
    '',
    `Product: ${product.name} (${product.url ?? 'no url'}).`,
    `Category: ${category || '(unspecified)'}. Value prop: ${valueProp || '(unspecified)'}. Pricing: ${pricing || '(unspecified)'}.`,
    '',
    'Respond ONLY as JSON: {"structureType":"give_get|credits|discount|cash|tiered","copy":{"landingHeadline":"","landingBody":"","landingCta":"","inAppTooltip":"","inviteEmailSubject":"","inviteEmailBody":"","socialPost":""}}',
  ].join('\n')

  try {
    const res = await fetch(GEMINI_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { responseMimeType: 'application/json', temperature: 0.6 } }),
      signal: AbortSignal.timeout(15_000),
    })
    if (!res.ok) return bad('GENERATION_FAILED', 502)
    const payload = await res.json()
    const parsed = JSON.parse(payload?.candidates?.[0]?.content?.parts?.[0]?.text ?? '{}')
    const structureType: ReferralStructure = STRUCTURES.includes(parsed.structureType) ? parsed.structureType : 'give_get'
    const c = parsed.copy ?? {}
    const copy: ReferralProgramCopy = {
      landingHeadline: String(c.landingHeadline ?? '').slice(0, 200),
      landingBody: String(c.landingBody ?? '').slice(0, 1000),
      landingCta: String(c.landingCta ?? '').slice(0, 80),
      inAppTooltip: String(c.inAppTooltip ?? '').slice(0, 300),
      inviteEmailSubject: String(c.inviteEmailSubject ?? '').slice(0, 160),
      inviteEmailBody: String(c.inviteEmailBody ?? '').slice(0, 1500),
      socialPost: String(c.socialPost ?? '').slice(0, 400),
    }
    if (!copy.landingHeadline && !copy.inviteEmailBody) return bad('GENERATION_FAILED', 502)

    await db.from('referral_programs').insert({
      product_id: productId,
      user_id: user.id,
      structure_type: structureType,
      generated_copy: copy,
    })

    return NextResponse.json({ ok: true, structureType, copy } satisfies ReferralGenerateResponse)
  } catch (err) {
    console.error('[referrals/generate] failed:', err)
    return bad('GENERATION_FAILED', 502)
  }
}
