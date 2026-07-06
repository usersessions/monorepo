import { NextResponse } from 'next/server'
import { authenticateBearer } from '@/lib/auth/bearer'
import type { CopyResponse, GeneratedCopy, PlatformCategory, SiteData } from '@usersessions/shared'

/**
 * POST /api/ai/copy — called by the extension (Bearer auth). The Gemini key lives ONLY here,
 * server-side; it never ships inside the extension bundle.
 * Returns platform-category-specific copy the user reviews and edits before anything is submitted.
 */

const WEDGE_CATEGORIES: PlatformCategory[] = ['ai', 'startup']

const GEMINI_URL =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent'

function buildPrompt(site: SiteData): string {
  return [
    'You write listing copy for software products being submitted to online directories.',
    'Given the product below, produce copy for EACH of these platform categories:',
    '- "ai": AI tool indexes. Direct capabilities. No vague hype. Specific models if known.',
    '- "startup": startup launch platforms. Founder voice, problem solved. Self-aware, not overpolished. NO soliciting upvotes.',
    '',
    'CRITICAL HONESTY RULES:',
    '- Zero fabricated facts. If the scraped data below doesn\'t explicitly say it, DO NOT invent it.',
    '- Do not invent a founder backstory, fake integrations, or a fake team size.',
    '- Do not claim 100% automation. Do not use the words "backlinks", "Domain Authority", "SEO", or "Trust Score".',
    'Hook: max 80 characters. Body: max 600 characters, plain text.',
    '',
    'CRITICAL: NEVER USE THESE WORDS:',
    'delve, robust, seamless, seamlessly, testament, pivotal, crucial, vibrant, landscape, tapestry, underscore, showcase, foster, garner, intricate, align with, enhance, groundbreaking, breathtaking, nestled, boasts, stands as, serves as, represents a, marks a shift, key turning point, evolving, cutting-edge, game-changer, unlock, leverage, empower, holistic, synergy, ecosystem, journey.',
    '',
    'CRITICAL CHECKLIST before returning output:',
    '- Zero fabricated numbers, statistics, or claims of scale',
    '- No "not just X, it\'s Y" constructions',
    '- No rule-of-three lists unless three is genuinely the right count',
    '- "Is/are" used instead of "serves as/boasts/features"',
    '- No emoji, no title-case headers in body text',
    '- No signposting ("here\'s what you need to know")',
    '- No claim of full/seamless/100% automation — "assisted" only',
    '- No banned product terms: backlinks, Domain Authority, SEO, Trust Score',
    '- At least one concrete, specific, product-real detail present',
    '',
    `Product title: ${site.title}`,
    `Product URL: ${site.url}`,
    `Description: ${site.description || '(none found)'}`,
    `Tagline: ${site.tagline ?? '(none found)'}`,
    `Keywords: ${site.keywords.join(', ') || '(none found)'}`,
    `Page headings: ${site.h1s.join(' | ') || '(none found)'}`,
    '',
    'Respond with ONLY a JSON array, no markdown, shaped exactly:',
    '[{"category":"ai","hook":"...","body":"..."},{"category":"startup","hook":"...","body":"..."}]',
  ].join('\n')
}

export async function POST(request: Request) {
  const user = await authenticateBearer(request)
  if (!user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })

  const key = process.env.GEMINI_API_KEY
  if (!key) return NextResponse.json({ error: 'AI_NOT_CONFIGURED' }, { status: 503 })

  let site: SiteData
  try {
    site = (await request.json()) as SiteData
    if (!site?.url || !site?.title) throw new Error('missing fields')
  } catch {
    return NextResponse.json({ error: 'INVALID_PAYLOAD' }, { status: 400 })
  }

  try {
    const res = await fetch(`${GEMINI_URL}?key=${key}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: buildPrompt(site) }] }],
        generationConfig: { responseMimeType: 'application/json', temperature: 0.7 },
      }),
    })
    if (!res.ok) throw new Error(`gemini ${res.status}`)

    const payload = await res.json()
    const text: string = payload?.candidates?.[0]?.content?.parts?.[0]?.text ?? '[]'
    const parsed = JSON.parse(text) as GeneratedCopy[]

    // Validate + clamp: only wedge categories, enforce length limits server-side.
    const copy: GeneratedCopy[] = parsed
      .filter((c) => WEDGE_CATEGORIES.includes(c.category))
      .map((c) => ({
        category: c.category,
        hook: String(c.hook ?? '').slice(0, 80),
        body: String(c.body ?? '').slice(0, 600),
      }))

    if (copy.length === 0) throw new Error('empty copy')

    const response: CopyResponse = { copy }
    return NextResponse.json(response)
  } catch (err) {
    console.error('[ai/copy] generation failed:', err)
    return NextResponse.json({ error: 'GENERATION_FAILED' }, { status: 502 })
  }
}
