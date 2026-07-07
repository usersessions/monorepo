import { NextResponse } from 'next/server'
import { authenticateBearer } from '@/lib/auth/bearer'
import { createServiceClient } from '@/lib/supabase/server'
import { rateLimit } from '@/lib/rate-limit'

/**
 * POST /api/agent/session — extension pushes agent session state transitions
 * (running/paused/completed/failed) so the dashboard monitor sees progress via
 * Supabase Realtime within seconds. Bearer auth; rows are scoped to the caller.
 */

const STATUSES = new Set(['running', 'paused', 'completed', 'failed'])
const RESULTS = new Set(['success', 'already_exists', 'error', 'cancelled'])

export async function POST(request: Request) {
  const user = await authenticateBearer(request)
  if (!user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
  if (!rateLimit(`agent-session:${user.id}`, 60, 60_000)) {
    return NextResponse.json({ error: 'RATE_LIMITED' }, { status: 429 })
  }

  let s: Record<string, unknown>
  try {
    s = (await request.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: 'INVALID_PAYLOAD' }, { status: 400 })
  }
  if (!s?.id || !s?.platformId || !STATUSES.has(String(s.status))) {
    return NextResponse.json({ error: 'INVALID_PAYLOAD' }, { status: 400 })
  }

  const db = createServiceClient()

  // Never let one user's extension overwrite another user's session row.
  const { data: existing } = await db.from('agent_sessions').select('user_id').eq('id', s.id).maybeSingle()
  if (existing && existing.user_id !== user.id) {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 })
  }

  const { error } = await db.from('agent_sessions').upsert({
    id: s.id,
    user_id: user.id,
    campaign_id: (s.campaignId as string) ?? null,
    product_id: (s.productId as string) ?? null,
    platform_id: String(s.platformId),
    status: String(s.status),
    current_step: Number(s.currentStep ?? 0),
    total_steps: Number(s.totalSteps ?? 0),
    paused_reason: (s.pausedReason as string) ?? null,
    simulated: s.simulated !== false,
    run_context: s.runContext ?? {},
    history: Array.isArray(s.history) ? s.history.slice(-100) : [],
    result: RESULTS.has(String(s.result)) ? String(s.result) : null,
    updated_at: new Date().toISOString(),
  })
  if (error) {
    console.error('[agent/session] upsert failed:', error)
    return NextResponse.json({ error: 'FAILED' }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
