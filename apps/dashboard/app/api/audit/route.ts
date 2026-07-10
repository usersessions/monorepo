import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { limitsFor } from '@/lib/tiers'
import { rateLimit } from '@/lib/rate-limit'
import type { AuditCategory, AuditResponse, LandingPageAuditResult } from '@usersessions/shared'

/**
 * POST /api/audit — AI Optimization (AIO) scorecard for a product's landing page.
 * Fetches the page server-side and scores how well AI assistants can understand and
 * recommend it. Heuristic-first; a Gemini call refines H1 clarity when a key is present.
 * Append-only, rate-limited (1/week free+founder, 1/day pro+agency). Honest failures.
 */

export const maxDuration = 30

const GEMINI_URL =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent'

function bad(error: AuditResponse['error'], status: number): NextResponse {
  return NextResponse.json({ ok: false, error } satisfies AuditResponse, { status })
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n))
}

/** Strip tags for text-density heuristics. */
function textOf(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .toLowerCase()
}

async function scoreH1WithGemini(h1: string, key: string): Promise<{ score: number; note: string } | null> {
  const prompt = [
    'You score how clearly an H1 states a product CATEGORY and audience for AI assistants.',
    `H1: "${h1}"`,
    'A high score (8-10) names a category and who it is for (e.g. "AI writing tool for marketers").',
    'A low score (0-4) is a vague brand slogan (e.g. "WriteFlow — write better").',
    'Respond ONLY as JSON: {"score":0-10,"note":"one short sentence"}',
  ].join('\n')
  try {
    const res = await fetch(`${GEMINI_URL}?key=${key}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: 'application/json', temperature: 0.2 },
      }),
      signal: AbortSignal.timeout(12_000),
    })
    if (!res.ok) return null
    const payload = await res.json()
    const parsed = JSON.parse(payload?.candidates?.[0]?.content?.parts?.[0]?.text ?? '{}')
    if (typeof parsed.score !== 'number') return null
    return { score: clamp(Math.round(parsed.score), 0, 10), note: String(parsed.note ?? '').slice(0, 200) }
  } catch {
    return null
  }
}

function analyze(html: string, h1Gemini: { score: number; note: string } | null): AuditCategory[] {
  const text = textOf(html)
  const lower = html.toLowerCase()
  const cats: AuditCategory[] = []

  // 1. H1 clarity (Gemini-refined when available, else heuristic).
  const h1Match = lower.match(/<h1[^>]*>([\s\S]*?)<\/h1>/)
  const h1Text = h1Match ? h1Match[1].replace(/<[^>]+>/g, '').trim() : ''
  const categoryWords = ['tool', 'platform', 'app', 'software', 'for ', 'ai ', 'saas', 'assistant', 'api']
  const heuristicH1 = !h1Text ? 0 : clamp(categoryWords.filter((w) => h1Text.toLowerCase().includes(w)).length * 3, 0, 10)
  const h1Score = h1Gemini ? h1Gemini.score : heuristicH1
  cats.push({
    name: 'h1_clarity',
    label: 'H1 category clarity',
    score: h1Score,
    max: 10,
    feedback: h1Text ? `H1: “${h1Text.slice(0, 80)}”${h1Gemini ? ` — ${h1Gemini.note}` : ''}` : 'No H1 found on the page.',
    suggestion: 'Use an H1 that names your category and audience, e.g. “The best [category] tool for [who]”.',
  })

  // 2. FAQ presence.
  const faqSchema = lower.includes('faqpage') || lower.includes('"question"')
  const questionCount = (text.match(/\?/g) ?? []).length
  const faqScore = faqSchema ? 10 : clamp(Math.floor(questionCount / 2), 0, 6)
  cats.push({
    name: 'faq_presence',
    label: 'FAQ content',
    score: faqScore,
    max: 10,
    feedback: faqSchema ? 'FAQ schema detected.' : `${questionCount} question-like phrases found; no FAQ schema.`,
    suggestion: 'Add an FAQ section with schema.org FAQPage markup — AI assistants quote these directly.',
  })

  // 3. Comparison content.
  const hasVs = /\bvs\.?\b|\balternative(s)?\b|\bcompared? to\b/.test(text)
  cats.push({
    name: 'comparison_content',
    label: 'Comparison / alternative content',
    score: hasVs ? 10 : 0,
    max: 10,
    feedback: hasVs ? 'Comparison/alternative language present.' : 'No “vs” or “alternative” content found.',
    suggestion: 'Add a “[You] vs [competitor]” or “free alternative to X” section — a top AI query pattern.',
  })

  // 4. Structured data.
  const jsonLd = lower.includes('application/ld+json')
  const productSchema = /"@type"\s*:\s*"(product|softwareapplication|organization)"/i.test(html)
  const sdScore = productSchema ? 15 : jsonLd ? 8 : 0
  cats.push({
    name: 'structured_data',
    label: 'Structured data (JSON-LD)',
    score: sdScore,
    max: 15,
    feedback: productSchema ? 'Product/SoftwareApplication/Organization schema found.' : jsonLd ? 'JSON-LD present but no product schema.' : 'No JSON-LD structured data.',
    suggestion: 'Add JSON-LD with @type SoftwareApplication (name, description, offers) so assistants parse you cleanly.',
  })

  // 5. Social proof density.
  const proofHits = (text.match(/testimonial|review|rated|stars|trusted by|customers|users love|★/g) ?? []).length
  cats.push({
    name: 'social_proof',
    label: 'Social proof',
    score: clamp(proofHits * 3, 0, 15),
    max: 15,
    feedback: `${proofHits} social-proof signals detected.`,
    suggestion: 'Add named testimonials or a “trusted by” row — assistants weight third-party validation.',
  })

  // 6. Pricing clarity.
  const hasFree = /\bfree (plan|tier|forever|trial)\b/.test(text)
  const hasPricing = /\bpricing\b|\bper month\b|\/mo\b|\bfree\b/.test(text)
  const priceScore = hasFree ? 15 : hasPricing ? 8 : 0
  cats.push({
    name: 'pricing_clarity',
    label: 'Pricing clarity',
    score: priceScore,
    max: 15,
    feedback: hasFree ? 'Free plan/tier mentioned.' : hasPricing ? 'Pricing present but no clear free option.' : 'No pricing information found.',
    suggestion: 'State a free plan or tier explicitly — “free alternative to X” is one of the highest-intent AI queries.',
  })

  // 7. Meta description.
  const metaMatch = lower.match(/<meta[^>]+name=["']description["'][^>]*content=["']([^"']*)["']/)
  const metaLen = metaMatch ? metaMatch[1].trim().length : 0
  const metaScore = metaLen >= 80 ? 10 : metaLen > 0 ? 5 : 0
  cats.push({
    name: 'meta_description',
    label: 'Meta description',
    score: metaScore,
    max: 10,
    feedback: metaLen > 0 ? `Meta description is ${metaLen} characters.` : 'No meta description found.',
    suggestion: 'Write a 120-160 char meta description that names the category and the core benefit.',
  })

  return cats
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return bad('UNAUTHORIZED', 401)

  let body: { productId?: unknown; url?: unknown }
  try {
    body = await request.json()
  } catch {
    return bad('INVALID_PAYLOAD', 400)
  }
  const productId = typeof body.productId === 'string' ? body.productId : ''
  let url = typeof body.url === 'string' ? body.url.trim() : ''
  if (!productId || !url) return bad('INVALID_PAYLOAD', 400)
  if (!/^https?:\/\//i.test(url)) url = `https://${url}`
  try {
    // eslint-disable-next-line no-new
    new URL(url)
  } catch {
    return bad('INVALID_PAYLOAD', 400)
  }

  const db = createServiceClient()

  // Ownership.
  const { data: product } = await db.from('products').select('id, user_id').eq('id', productId).maybeSingle()
  if (!product || product.user_id !== user.id) return bad('UNAUTHORIZED', 403)

  // Plan-gated cadence: 1/day for pro+agency, else 1/week. Enforced against stored audits.
  const { data: profile } = await db.from('profiles').select('plan').eq('id', user.id).maybeSingle()
  const plan = profile?.plan ?? 'free'
  const windowMs = plan === 'pro' || plan === 'agency' ? 86_400_000 : 7 * 86_400_000
  const { data: recent } = await db
    .from('landing_page_audits')
    .select('created_at')
    .eq('product_id', productId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (recent && Date.now() - new Date(recent.created_at).getTime() < windowMs) {
    return bad('PLAN_LIMIT_EXCEEDED', 429)
  }
  // Abuse backstop on top of the cadence gate.
  if (!rateLimit(`audit:${user.id}`, 10, 60_000)) return bad('RATE_LIMITED', 429)

  // Fetch the page server-side, fail gracefully.
  let html = ''
  try {
    const res = await fetch(url, {
      redirect: 'follow',
      headers: { 'user-agent': 'Mozilla/5.0 (compatible; usersessions-aio-audit/1.0; +https://usersessions.io)' },
      signal: AbortSignal.timeout(12_000),
    })
    if (!res.ok) return bad('FETCH_FAILED', 502)
    html = (await res.text()).slice(0, 500_000) // cap to keep parsing cheap
  } catch {
    return bad('FETCH_FAILED', 502)
  }

  // H1 refinement via Gemini (optional).
  const key = process.env.GEMINI_API_KEY
  const h1Match = html.toLowerCase().match(/<h1[^>]*>([\s\S]*?)<\/h1>/)
  const h1Text = h1Match ? h1Match[1].replace(/<[^>]+>/g, '').trim() : ''
  const h1Gemini = key && h1Text ? await scoreH1WithGemini(h1Text, key) : null

  const categories = analyze(html, h1Gemini)
  const totalScore = categories.reduce((s, c) => s + c.score, 0)
  const totalMax = categories.reduce((s, c) => s + c.max, 0)
  const overallScore = Math.round((totalScore / totalMax) * 100)

  // Top priority = the lowest-scoring category by fraction of its max.
  const topCat = [...categories].sort((a, b) => a.score / a.max - b.score / b.max)[0]
  const topPriority = topCat.suggestion

  const auditedAt = new Date().toISOString()
  await db.from('landing_page_audits').insert({
    product_id: productId,
    user_id: user.id,
    url,
    overall_score: overallScore,
    categories,
    top_priority: topPriority,
  })

  const audit: LandingPageAuditResult = { productId, url, overallScore, categories, topPriority, auditedAt }
  return NextResponse.json({ ok: true, audit } satisfies AuditResponse)
}
