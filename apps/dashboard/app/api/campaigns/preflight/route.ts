import { NextResponse } from 'next/server'
import { authenticateBearer } from '@/lib/auth/bearer'
import { createServiceClient } from '@/lib/supabase/server'
import type { PreflightResponse, PreflightWarning } from '@usersessions/shared'

const GEMINI_URL =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent'

/**
 * Brand-fit preflight (BUILD_SPEC §10) — called by the extension BEFORE a campaign starts.
 * STRICT confidence threshold: if the model is not confident a platform is a poor fit, it
 * says nothing. Returning zero warnings is correct behavior, not a failure of the feature.
 */
export async function POST(request: Request) {
  const user = await authenticateBearer(request)
  if (!user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })

  const key = process.env.GEMINI_API_KEY
  const empty: PreflightResponse = { warnings: [] }
  if (!key) return NextResponse.json(empty) // fail open to zero warnings — never block a launch on a config gap

  let body: { title?: string; description?: string; platformIds?: string[] }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'INVALID_PAYLOAD' }, { status: 400 })
  }
  const platformIds = Array.isArray(body.platformIds) ? body.platformIds.slice(0, 30) : []
  if (!body.title || platformIds.length === 0) return NextResponse.json(empty)

  const db = createServiceClient()
  const { data: platforms } = await db
    .from('platforms')
    .select('id, name, category')
    .in('id', platformIds)

  const prompt = [
    'You review whether a product is a POOR fit for specific listing platforms.',
    'Only flag a platform if you are HIGHLY confident it is a poor fit — when unsure, stay silent.',
    'An empty warnings array is a perfectly good answer.',
    '',
    `Product: ${body.title}`,
    `Description: ${body.description ?? '(none)'}`,
    '',
    'Platforms:',
    ...(platforms ?? []).map((p) => `- ${p.id}: ${p.name} (category: ${p.category})`),
    '',
    'Respond with ONLY JSON: {"warnings":[{"platformId":"...","reason":"...","suggestedAngle":"..."}]}',
  ].join('\n')

  try {
    const res = await fetch(`${GEMINI_URL}?key=${key}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: 'application/json', temperature: 0.2 },
      }),
      signal: AbortSignal.timeout(15_000),
    })
    if (!res.ok) return NextResponse.json(empty)

    const payload = await res.json()
    const parsed = JSON.parse(payload?.candidates?.[0]?.content?.parts?.[0]?.text ?? '{}')
    const validIds = new Set((platforms ?? []).map((p) => p.id))
    const warnings: PreflightWarning[] = Array.isArray(parsed.warnings)
      ? parsed.warnings
          .filter((w: PreflightWarning) => validIds.has(w.platformId))
          .map((w: PreflightWarning) => ({
            platformId: w.platformId,
            reason: String(w.reason ?? '').slice(0, 300),
            suggestedAngle: String(w.suggestedAngle ?? '').slice(0, 300),
          }))
      : []

    return NextResponse.json({ warnings } satisfies PreflightResponse)
  } catch {
    return NextResponse.json(empty)
  }
}
