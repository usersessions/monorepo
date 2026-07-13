import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { rateLimit } from '@/lib/rate-limit'
import { trackFeatureServer } from '@/lib/tracking-server'
import type { SuggestedQuery, SuggestQueriesResponse, VisibilityQueryType } from '@usersessions/shared'

/**
 * POST /api/visibility/suggest — AI-proposes 5 category queries for a product across the
 * four query types. The user reviews/edits/approves in the UI before any row is saved;
 * NOTHING is persisted here (honesty: no fabricated tracked queries appear automatically).
 */

export const maxDuration = 30

const GEMINI_MODEL = process.env.GEMINI_MODEL ?? 'gemini-2.5-flash'
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`

const TYPES: VisibilityQueryType[] = ['category_direct', 'use_case', 'comparison', 'alternative']

function bad(error: SuggestQueriesResponse['error'], status: number): NextResponse {
  return NextResponse.json({ ok: false, error } satisfies SuggestQueriesResponse, { status })
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return bad('UNAUTHORIZED', 401)

  let body: { productId?: unknown }
  try {
    body = await request.json()
  } catch {
    return bad('INVALID_PAYLOAD', 400)
  }
  const productId = typeof body.productId === 'string' ? body.productId : ''
  if (!productId) return bad('INVALID_PAYLOAD', 400)

  if (!rateLimit(`suggest:${user.id}`, 10, 60_000)) return bad('RATE_LIMITED', 429)
  trackFeatureServer(user.id, 'ai_visibility_suggest', 'generate', { productId })

  const db = createServiceClient()
  const { data: product } = await db
    .from('products')
    .select('id, user_id, name, url')
    .eq('id', productId)
    .maybeSingle()
  if (!product || product.user_id !== user.id) return bad('UNAUTHORIZED', 403)

  const key = process.env.GEMINI_API_KEY
  if (!key) return bad('AI_NOT_CONFIGURED', 503)

  const prompt = [
    'You propose the search queries a real buyer would type into an AI assistant (ChatGPT,',
    'Perplexity, Gemini) when looking for a product like the one below. These become tracked',
    'queries the founder will verify — so they must be realistic, category-shaped, and honest.',
    '',
    'Return EXACTLY 5 queries, one of each of these types where sensible:',
    '- category_direct: "best <category> tool" style',
    '- use_case: "<category> tool for <specific use case>"',
    '- comparison: "<this product> vs <a plausible real competitor>"',
    '- alternative: "free alternative to <a plausible real competitor>"',
    '- category_direct (second angle): "who makes the best <category>"',
    '',
    'RULES: infer the category ONLY from the product data below. Do NOT invent product features.',
    'Competitor names in comparison/alternative should be well-known real tools in this category;',
    'if you are not reasonably sure of a real competitor, use a category_direct/use_case query instead.',
    '',
    `Product name: ${product.name}`,
    `Product URL: ${product.url ?? '(none)'}`,
    '',
    'Respond with ONLY a JSON array shaped exactly:',
    '[{"query":"...","queryType":"category_direct","categoryTag":"short-slug"}]',
  ].join('\n')

  try {
    const res = await fetch(GEMINI_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: 'application/json', temperature: 0.5 },
        // eslint-disable-next-line no-restricted-syntax
      }),
      signal: AbortSignal.timeout(15_000),
    })
    if (!res.ok) return bad('GENERATION_FAILED', 502)
    const payload = await res.json()
    const parsed = JSON.parse(payload?.candidates?.[0]?.content?.parts?.[0]?.text ?? '[]')
    if (!Array.isArray(parsed)) return bad('GENERATION_FAILED', 502)

    const suggestions: SuggestedQuery[] = parsed
      .filter((s: unknown): s is Record<string, unknown> => typeof s === 'object' && s !== null)
      .map((s) => ({
        query: String(s.query ?? '').slice(0, 200),
        queryType: TYPES.includes(s.queryType as VisibilityQueryType)
          ? (s.queryType as VisibilityQueryType)
          : 'category_direct',
        categoryTag: s.categoryTag ? String(s.categoryTag).slice(0, 60) : null,
      }))
      .filter((s) => s.query.trim().length > 0)
      .slice(0, 5)

    if (suggestions.length === 0) return bad('GENERATION_FAILED', 502)
    return NextResponse.json({ ok: true, suggestions } satisfies SuggestQueriesResponse)
  } catch (err) {
    console.error('[visibility/suggest] failed:', err)
    return bad('GENERATION_FAILED', 502)
  }
}
