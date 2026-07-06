import { NextResponse } from 'next/server'
import { authenticateBearer } from '@/lib/auth/bearer'
import type { CopyResponse, GeneratedCopy, PlatformCategory, SiteData } from '@usersessions/shared'

/**
 * POST /api/ai/copy — called by the extension (Bearer auth). The Gemini key lives ONLY here,
 * server-side; it never ships inside the extension bundle.
 * Returns platform-category-specific copy the user reviews and edits before anything is submitted.
 */

const WEDGE_CATEGORIES: PlatformCategory[] = ['ai', 'startup']

// Model is env-configurable. Default tracks a CURRENT Flash model:
// gemini-1.5-flash was retired upstream and 404s, which surfaced to users
// as a generic 'copy generation failed'.
const GEMINI_MODEL = process.env.GEMINI_MODEL ?? 'gemini-2.5-flash'
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`

function buildPrompt(site: SiteData): string {
  return [
    'You write listing copy for software products being submitted to online directories.',
    'Given the product below, produce copy for EACH of these platform categories:',
    '- "ai": AI tool indexes. Lead with capability and concrete use cases. Factual, specific.',
    '- "startup": startup launch platforms. Lead with the founder story and the problem solved.',
    '',
    'Rules: no invented metrics, no invented users or testimonials, no superlative spam.',
    'Hook: max 80 characters. Body: max 600 characters, plain text.',
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
    const res = await fetch(GEMINI_URL, {
      method: 'POST',
      // Key in a header, never in the URL — URLs end up in logs.
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify({
        contents: [{ parts: [{ text: buildPrompt(site) }] }],
        generationConfig: { responseMimeType: 'application/json', temperature: 0.7 },
      }),
    })
    if (!res.ok) {
      const bodyText = await res.text().catch(() => '')
      throw new Error(`gemini ${res.status} (model=${GEMINI_MODEL}): ${bodyText.slice(0, 300)}`)
    }

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
