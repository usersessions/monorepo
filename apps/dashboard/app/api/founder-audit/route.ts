import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { limitsFor } from '@/lib/tiers'
import { rateLimit } from '@/lib/rate-limit'
import { trackFeatureServer } from '@/lib/tracking'
import type { FounderAuditResponse, FounderPlatform, FounderPlatformScore } from '@usersessions/shared'

/**
 * POST /api/founder-audit — scores a founder's personal profiles for how clearly they signal
 * “builder of <product>, a <category> tool”, and generates optimized, editable copy per
 * platform. Server-side fetch (best-effort; many of these block bots) + Gemini scoring.
 * Cadence-gated per plan. Honest: unreachable profiles score low with a clear reason.
 */

export const maxDuration = 45

const GEMINI_MODEL = process.env.GEMINI_MODEL ?? 'gemini-2.5-flash'
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`

const LABEL: Record<FounderPlatform, string> = {
  linkedin: 'LinkedIn',
  twitter: 'X / Twitter',
  github: 'GitHub',
  indiehackers: 'Indie Hackers',
}

function bad(error: FounderAuditResponse['error'], status: number): NextResponse {
  return NextResponse.json({ ok: false, error } satisfies FounderAuditResponse, { status })
}

/** Best-effort fetch of public profile text. Many of these block bots — failure is honest, not fatal. */
async function fetchText(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      redirect: 'follow',
      headers: { 'user-agent': 'Mozilla/5.0 (compatible; usersessions-founder-audit/1.0; +https://usersessions.io)' },
      signal: AbortSignal.timeout(10_000),
    })
    if (!res.ok) return null
    const html = (await res.text()).slice(0, 200_000)
    return html
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .slice(0, 6000)
  } catch {
    return null
  }
}

async function scorePlatform(
  key: string,
  platform: FounderPlatform,
  productName: string,
  handleOrUrl: string,
  pageText: string | null
): Promise<FounderPlatformScore> {
  const focus: Record<FounderPlatform, string> = {
    linkedin: 'headline/bio clarity (does it name the product + category?), featured section, article activity',
    twitter: 'bio clarity, a pinned post about the product, category authority signals',
    github: 'profile README presence, pinned repos relevant to the product',
    indiehackers: 'maker profile completeness and product posts',
  }
  const fallback: FounderPlatformScore = {
    platform,
    label: LABEL[platform],
    score: pageText ? 5 : 0,
    max: 10,
    feedback: pageText ? 'Analyzed, but scoring was unavailable.' : 'Could not fetch this profile (it may block automated access).',
    suggestion: `Make sure your ${LABEL[platform]} clearly states you build ${productName} and what category it is in.`,
    suggestedCopy: `Builder of ${productName}. [what it does] for [who].`,
  }
  if (!key) return fallback
  const prompt = [
    `Score a founder's ${LABEL[platform]} profile for how clearly it signals they build "${productName}" and its category.`,
    `Focus on: ${focus[platform]}.`,
    pageText ? `Profile text (may be partial):\n${pageText}` : 'The profile could not be fetched; score low and say so.',
    'Also write ready-to-paste optimized copy (a headline/bio or pinned-post line) that names the product and category, honest, no hype words.',
    'Respond ONLY as JSON: {"score":0-10,"feedback":"one sentence","suggestion":"one actionable sentence","suggestedCopy":"..."}',
  ].join('\n')
  try {
    const res = await fetch(GEMINI_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: 'application/json', temperature: 0.3 },
      }),
      signal: AbortSignal.timeout(12_000),
    })
    if (!res.ok) return fallback
    const payload = await res.json()
    const p = JSON.parse(payload?.candidates?.[0]?.content?.parts?.[0]?.text ?? '{}')
    if (typeof p.score !== 'number') return fallback
    return {
      platform,
      label: LABEL[platform],
      score: Math.max(0, Math.min(10, Math.round(p.score))),
      max: 10,
      feedback: String(p.feedback ?? fallback.feedback).slice(0, 200),
      suggestion: String(p.suggestion ?? fallback.suggestion).slice(0, 200),
      suggestedCopy: String(p.suggestedCopy ?? fallback.suggestedCopy).slice(0, 400),
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
  if (!rateLimit(`founderaudit:${user.id}`, 5, 60_000)) return bad('RATE_LIMITED', 429)
  trackFeatureServer(user.id, 'founder_audit', 'generate')

  let body: { productId?: unknown; linkedinUrl?: unknown; twitterHandle?: unknown; githubUrl?: unknown; indiehackersUrl?: unknown }
  try {
    body = await request.json()
  } catch {
    return bad('INVALID_PAYLOAD', 400)
  }
  const productId = typeof body.productId === 'string' ? body.productId : ''
  const linkedin = typeof body.linkedinUrl === 'string' ? body.linkedinUrl.trim().slice(0, 300) : ''
  const twitter = typeof body.twitterHandle === 'string' ? body.twitterHandle.trim().replace(/^@/, '').slice(0, 60) : ''
  const github = typeof body.githubUrl === 'string' ? body.githubUrl.trim().slice(0, 300) : ''
  const indie = typeof body.indiehackersUrl === 'string' ? body.indiehackersUrl.trim().slice(0, 300) : ''
  if (!productId || (!linkedin && !twitter && !github && !indie)) return bad('INVALID_PAYLOAD', 400)

  const db = createServiceClient()
  const { data: product } = await db.from('products').select('id, user_id, name').eq('id', productId).maybeSingle()
  if (!product || product.user_id !== user.id) return bad('UNAUTHORIZED', 403)

  const { data: profile } = await db.from('profiles').select('plan').eq('id', user.id).maybeSingle()
  const limits = limitsFor(profile?.plan)
  if (limits.founderAuditIntervalDays === 0) return bad('PLAN_LIMIT_EXCEEDED', 403)
  const { data: recent } = await db
    .from('founder_audits')
    .select('created_at')
    .eq('product_id', productId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (recent && Date.now() - new Date(recent.created_at).getTime() < limits.founderAuditIntervalDays * 86_400_000) {
    return bad('PLAN_LIMIT_EXCEEDED', 429)
  }

  const key = process.env.GEMINI_API_KEY
  const targets: Array<{ platform: FounderPlatform; value: string; url: string }> = []
  if (linkedin) targets.push({ platform: 'linkedin', value: linkedin, url: linkedin })
  if (twitter) targets.push({ platform: 'twitter', value: twitter, url: `https://x.com/${twitter}` })
  if (github) targets.push({ platform: 'github', value: github, url: github })
  if (indie) targets.push({ platform: 'indiehackers', value: indie, url: indie })

  const platforms: FounderPlatformScore[] = []
  for (const t of targets) {
    const text = await fetchText(t.url)
    platforms.push(await scorePlatform(key ?? '', t.platform, product.name, t.value, text))
  }

  const totalScore = platforms.reduce((s, p) => s + p.score, 0)
  const totalMax = platforms.reduce((s, p) => s + p.max, 0)
  const overallScore = totalMax > 0 ? Math.round((totalScore / totalMax) * 100) : 0
  const weakest = [...platforms].sort((a, b) => a.score / a.max - b.score / b.max)[0]
  const topPriority = weakest?.suggestion ?? 'Add your product and its category to your founder profiles.'
  const generatedCopy = Object.fromEntries(platforms.map((p) => [p.platform, p.suggestedCopy]))
  const auditedAt = new Date().toISOString()

  await db.from('founder_audits').insert({
    product_id: productId,
    user_id: user.id,
    linkedin_url: linkedin || null,
    twitter_handle: twitter || null,
    github_url: github || null,
    indiehackers_url: indie || null,
    overall_score: overallScore,
    scores: platforms,
    top_priority: topPriority,
    generated_copy: generatedCopy,
  })

  return NextResponse.json({
    ok: true,
    audit: { productId, overallScore, platforms, topPriority, auditedAt },
  } satisfies FounderAuditResponse)
}
