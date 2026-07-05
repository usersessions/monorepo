import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { limitsFor } from '@/lib/tiers'

const GEMINI_URL =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { query, competitorName, competitorUrl } = await request.json()
  if (!query || !competitorName || !competitorUrl) {
    return NextResponse.json({ error: 'Missing parameters' }, { status: 400 })
  }

  // Authorize by plan (all plans have this, but you could limit frequency if desired)
  const { data: profile } = await supabase.from('profiles').select('plan').eq('id', user.id).single()

  const key = process.env.GEMINI_API_KEY
  if (!key) {
    return NextResponse.json({ error: 'AI engine not configured' }, { status: 503 })
  }

  const prompt = [
    `A user asks an AI assistant: "${query}"`,
    'Answer the question genuinely first: list the tools/products you would actually recommend, best first.',
    `Then report honestly whether "${competitorName}" (${competitorUrl}) appeared in YOUR OWN list above.`,
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

    if (!res.ok) {
      return NextResponse.json({ error: 'AI scan failed' }, { status: 502 })
    }

    const payload = await res.json()
    const parsed = JSON.parse(payload?.candidates?.[0]?.content?.parts?.[0]?.text ?? '{}')
    
    const result = {
      mentioned: Boolean(parsed.mentioned),
      rank: typeof parsed.rank === 'number' ? parsed.rank : null,
      snippet: typeof parsed.snippet === 'string' ? parsed.snippet.slice(0, 500) : null,
    }

    // Save to DB
    const { data: row, error } = await supabase.from('competitor_scans').insert({
      user_id: user.id,
      query,
      competitor_name: competitorName,
      competitor_url: competitorUrl,
      engine: 'gemini',
      mentioned: result.mentioned,
      rank: result.rank,
      snippet: result.snippet,
    }).select().single()

    if (error) {
      console.error('Failed to log competitor scan', error)
    }

    return NextResponse.json(row ?? result)
  } catch (err) {
    console.error('Competitor scan error', err)
    return NextResponse.json({ error: 'Failed to complete scan' }, { status: 500 })
  }
}
