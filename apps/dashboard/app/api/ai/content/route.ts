import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { limitsFor, monthStartIso } from '@/lib/tiers'
import { rateLimit } from '@/lib/rate-limit'
import type { ContentGenerateResponse, ContentType } from '@usersessions/shared'

/**
 * POST /api/ai/content — server-side Gemini drafts comparison/FAQ content the founder edits
 * and publishes on their OWN site. Honest: no fabricated benchmarks; competitor claims must be
 * verifiable and fair. Metered per plan. Nothing is published automatically.
 */

export const maxDuration = 45

const GEMINI_MODEL = process.env.GEMINI_MODEL ?? 'gemini-2.5-flash'
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`

const TYPES: ContentType[] = ['vs_page', 'best_tools_roundup', 'alternative_post', 'faq_page']

function bad(error: ContentGenerateResponse['error'], status: number): NextResponse {
  return NextResponse.json({ ok: false, error } satisfies ContentGenerateResponse, { status })
}

const SHAPE: Record<ContentType, string> = {
  vs_page: 'A fair “<product> vs <competitor>” comparison page: intro, an honest comparison table (markdown), who each tool is best for, and a balanced verdict. Never claim to win on everything.',
  best_tools_roundup: 'A “best <category> tools” roundup listing the competitors AND this product, each with an honest one-paragraph take. Rank on real, stated criteria.',
  alternative_post: 'A “<product> as an alternative to <competitor>” post: who should switch, who should NOT, and an honest migration note.',
  faq_page: 'An FAQ page (8-10 Q&As) a buyer would ask about this product and category, answered factually.',
}

const SCHEMA_SUGGESTION: Record<ContentType, string> = {
  vs_page: '{"@context":"https://schema.org","@type":"Article","headline":"<product> vs <competitor>"}',
  best_tools_roundup: '{"@context":"https://schema.org","@type":"ItemList"}',
  alternative_post: '{"@context":"https://schema.org","@type":"Article"}',
  faq_page: '{"@context":"https://schema.org","@type":"FAQPage","mainEntity":[{"@type":"Question","name":"...","acceptedAnswer":{"@type":"Answer","text":"..."}}]}',
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return bad('UNAUTHORIZED', 401)
  if (!rateLimit(`content:${user.id}`, 10, 60_000)) return bad('RATE_LIMITED', 429)

  let body: { productId?: unknown; contentType?: unknown; competitors?: unknown }
  try {
    body = await request.json()
  } catch {
    return bad('INVALID_PAYLOAD', 400)
  }
  const productId = typeof body.productId === 'string' ? body.productId : ''
  const contentType = TYPES.includes(body.contentType as ContentType) ? (body.contentType as ContentType) : null
  const competitors = Array.isArray(body.competitors)
    ? body.competitors.filter((c: unknown): c is string => typeof c === 'string').slice(0, 3)
    : []
  if (!productId || !contentType) return bad('INVALID_PAYLOAD', 400)

  const db = createServiceClient()
  const { data: product } = await db.from('products').select('id, user_id, name, url').eq('id', productId).maybeSingle()
  if (!product || product.user_id !== user.id) return bad('UNAUTHORIZED', 403)

  const { data: profile } = await db.from('profiles').select('plan').eq('id', user.id).maybeSingle()
  const limits = limitsFor(profile?.plan)
  if (limits.contentPerMonth === 0) return bad('PLAN_LIMIT_EXCEEDED', 403)
  if (limits.contentPerMonth !== null) {
    const { count } = await db
      .from('generated_content')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .gte('created_at', monthStartIso())
    if ((count ?? 0) >= limits.contentPerMonth) return bad('PLAN_LIMIT_EXCEEDED', 403)
  }

  const key = process.env.GEMINI_API_KEY
  if (!key) return bad('AI_NOT_CONFIGURED', 503)

  const prompt = [
    'You draft honest marketing content a founder will EDIT before publishing on their own site.',
    'Rules: zero fabricated numbers/benchmarks; be fair to competitors; no hype words',
    '(delve, seamless, leverage, game-changer, etc.); never say “SEO” or “backlinks”.',
    '',
    SHAPE[contentType],
    '',
    `Product: ${product.name} (${product.url ?? 'no url'}).`,
    competitors.length ? `Competitors: ${competitors.join(', ')}.` : 'No competitors specified — keep it product/category focused.',
    '',
    'Respond with ONLY the content as GitHub-flavored Markdown. No preamble.',
  ].join('\n')

  try {
    const res = await fetch(GEMINI_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0.6 } }),
      signal: AbortSignal.timeout(30_000),
    })
    if (!res.ok) return bad('GENERATION_FAILED', 502)
    const payload = await res.json()
    const markdown = String(payload?.candidates?.[0]?.content?.parts?.[0]?.text ?? '').trim()
    if (!markdown) return bad('GENERATION_FAILED', 502)
    return NextResponse.json({
      ok: true,
      markdown: markdown.slice(0, 20_000),
      schemaSuggestion: SCHEMA_SUGGESTION[contentType],
    } satisfies ContentGenerateResponse)
  } catch (err) {
    console.error('[ai/content] failed:', err)
    return bad('GENERATION_FAILED', 502)
  }
}
