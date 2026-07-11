import { NextResponse } from 'next/server'
import { authenticateBearer } from '@/lib/auth/bearer'
import { createServiceClient } from '@/lib/supabase/server'
import { planRank } from '@/lib/tiers'
import { rateLimit } from '@/lib/rate-limit'
import type { SurfaceCopyResponse } from '@usersessions/shared'

/**
 * POST /api/surfaces/copy — surface-specific assisted copy (Bearer, called by the extension).
 * Gemini key stays server-side. Copy is a DRAFT the user edits before posting; nothing is
 * submitted automatically. Tier-gated by the surface's tier_unlock.
 */

export const maxDuration = 30

const GEMINI_MODEL = process.env.GEMINI_MODEL ?? 'gemini-2.5-flash'
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`

function bad(error: SurfaceCopyResponse['error'], status: number): NextResponse {
  return NextResponse.json({ ok: false, error } satisfies SurfaceCopyResponse, { status })
}

const FORMAT: Record<string, string> = {
  github:
    'Write a concise GitHub Pull Request description proposing to add this product to an "awesome" list: one line what it is, one line why it belongs, and a correctly formatted markdown list entry `- [Name](url) - description`.',
  blog:
    'Write a short blog-post OUTLINE (title + 4-5 bullet section headers) a founder could expand into an honest article featuring this product. No fabricated benchmarks.',
  community:
    'Write an honest Indie-Hackers-style product post: what you built, the problem, and one specific thing you want feedback on. Founder voice, no upvote begging.',
  stackoverflow:
    'Suggest 2-3 real Stack Overflow question topics this product genuinely helps answer, plus a one-paragraph honest answer skeleton that mentions the product only where relevant. Never spam.',
  twitter:
    'Write one honest pinned-tweet (max 260 chars) describing what the product does and who it is for. No hashtag stuffing, no hype words.',
  podcast: 'Write a 2-sentence pitch a founder could send to a relevant podcast host. Honest, specific, no flattery padding.',
  youtube: 'Write a short honest video description (2-3 sentences) for a product demo. No clickbait.',
}

export async function POST(request: Request) {
  const user = await authenticateBearer(request)
  if (!user) return bad('UNAUTHORIZED', 401)
  if (!rateLimit(`surfacecopy:${user.id}`, 20, 60_000)) return bad('RATE_LIMITED', 429)

  let body: { surfaceId?: unknown; title?: unknown; url?: unknown; description?: unknown }
  try {
    body = await request.json()
  } catch {
    return bad('INVALID_PAYLOAD', 400)
  }
  const surfaceId = typeof body.surfaceId === 'string' ? body.surfaceId : ''
  const title = typeof body.title === 'string' ? body.title.slice(0, 200) : ''
  const url = typeof body.url === 'string' ? body.url.slice(0, 500) : ''
  const description = typeof body.description === 'string' ? body.description.slice(0, 1000) : ''
  if (!surfaceId || !title) return bad('INVALID_PAYLOAD', 400)

  const db = createServiceClient()
  const { data: surface } = await db
    .from('surfaces')
    .select('category, tier_unlock')
    .eq('id', surfaceId)
    .maybeSingle()
  if (!surface) return bad('INVALID_PAYLOAD', 400)

  const { data: profile } = await db.from('profiles').select('plan').eq('id', user.id).maybeSingle()
  if (planRank(profile?.plan) < surface.tier_unlock) return bad('TIER_LOCKED', 403)

  const key = process.env.GEMINI_API_KEY
  if (!key) return bad('AI_NOT_CONFIGURED', 503)

  const format = FORMAT[surface.category] ?? FORMAT.blog
  const prompt = [
    'You draft honest distribution copy a founder will EDIT before posting. Never invent facts,',
    'benchmarks, or a backstory. No hype words (delve, seamless, leverage, game-changer, etc.).',
    'No upvote/vote begging. No "backlinks"/"SEO" language.',
    '',
    format,
    '',
    `Product: ${title}`,
    `URL: ${url || '(none)'}`,
    `Description: ${description || '(none provided)'}`,
    '',
    'Respond with ONLY the plain-text draft, no preamble.',
  ].join('\n')

  try {
    const res = await fetch(GEMINI_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.6 },
      }),
      signal: AbortSignal.timeout(15_000),
    })
    if (!res.ok) return bad('GENERATION_FAILED', 502)
    const payload = await res.json()
    const copy = String(payload?.candidates?.[0]?.content?.parts?.[0]?.text ?? '').trim()
    if (!copy) return bad('GENERATION_FAILED', 502)
    return NextResponse.json({ ok: true, copy: copy.slice(0, 2000) } satisfies SurfaceCopyResponse)
  } catch (err) {
    console.error('[surfaces/copy] failed:', err)
    return bad('GENERATION_FAILED', 502)
  }
}
