import { NextResponse } from 'next/server'
import { authorizeCron, logCron } from '@/lib/cron'
import { createServiceClient } from '@/lib/supabase/server'

export const maxDuration = 300

const BATCH = 50
const GEMINI_URL =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent'

/**
 * AI Visibility weekly check (BUILD_SPEC §10). Engine coverage is HONEST: currently
 * 'gemini' only — ChatGPT and Perplexity engines activate when their API keys exist.
 * Snippets are stored VERBATIM; a 'not mentioned' result is recorded and shown, never smoothed.
 */
async function checkQuery(
  key: string,
  query: string,
  productName: string,
  productUrl: string
): Promise<{ mentioned: boolean; rank: number | null; snippet: string | null } | null> {
  const prompt = [
    `A user asks an AI assistant: "${query}"`,
    'Answer the question genuinely first: list the tools/products you would actually recommend, best first.',
    `Then report honestly whether "${productName}" (${productUrl}) appeared in YOUR OWN list above.`,
    'Do not add it if it was not genuinely in your recommendations.',
    'Respond with ONLY JSON: {"recommendations":["..."],"mentioned":boolean,"rank":number|null,"snippet":"the exact sentence mentioning it, or null"}',
  ].join('\n')

  try {
    const res = await fetch(`${GEMINI_URL}?key=${key}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: 'application/json', temperature: 0.3 },
      }),
      signal: AbortSignal.timeout(20_000),
    })
    if (!res.ok) return null
    const payload = await res.json()
    const parsed = JSON.parse(payload?.candidates?.[0]?.content?.parts?.[0]?.text ?? '{}')
    return {
      mentioned: Boolean(parsed.mentioned),
      rank: typeof parsed.rank === 'number' ? parsed.rank : null,
      snippet: typeof parsed.snippet === 'string' ? parsed.snippet.slice(0, 500) : null,
    }
  } catch {
    return null
  }
}

export async function GET(request: Request) {
  if (!authorizeCron(request)) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })

  const key = process.env.GEMINI_API_KEY
  if (!key) {
    await logCron('ai-visibility', 'failed', { error: 'GEMINI_API_KEY missing' })
    return NextResponse.json({ ok: false, error: 'AI_NOT_CONFIGURED' }, { status: 503 })
  }

  const db = createServiceClient()
  const stats = { queries: 0, checked: 0, mentioned: 0, changes: 0 }

  try {
    const { data: queries } = await db
      .from('visibility_queries')
      .select('id, user_id, query, products(name, url)')
      .limit(BATCH)

    for (const q of queries ?? []) {
      stats.queries++
      const product = q.products as { name?: string; url?: string } | null
      if (!product?.name || !product?.url) continue

      const result = await checkQuery(key, q.query, product.name, product.url)
      if (!result) continue // engine failure → no row at all; never a guessed result
      stats.checked++
      if (result.mentioned) stats.mentioned++

      // Previous state for change detection
      const { data: prev } = await db
        .from('visibility_checks')
        .select('mentioned')
        .eq('query_id', q.id)
        .eq('engine', 'gemini')
        .order('checked_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      await db.from('visibility_checks').insert({
        query_id: q.id,
        user_id: q.user_id,
        engine: 'gemini',
        mentioned: result.mentioned,
        rank: result.rank,
        snippet: result.snippet,
      })

      if (prev && prev.mentioned !== result.mentioned) {
        stats.changes++
        await db.from('notifications').insert({
          user_id: q.user_id,
          kind: 'visibility_change',
          title: result.mentioned ? 'AI started recommending you' : 'AI stopped recommending you',
          body: `Gemini ${result.mentioned ? 'now mentions' : 'no longer mentions'} ${product.name} for “${q.query}”.`,
        })
      }
    }

    await logCron('ai-visibility', 'ok', stats)
    return NextResponse.json({ ok: true, ...stats })
  } catch (err) {
    await logCron('ai-visibility', 'failed', { error: String(err), ...stats })
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}
