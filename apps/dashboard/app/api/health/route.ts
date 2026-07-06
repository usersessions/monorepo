import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

/**
 * GET /api/health - liveness + readiness probe for synthetic monitoring.
 * Liveness: the process answered. Readiness: the database is reachable.
 * Returns 503 when the DB check fails so uptime monitors alert correctly.
 * No auth: exposes nothing but a boolean and a timestamp.
 */
export async function GET() {
  const startedAt = Date.now()
  let dbOk = false
  try {
    const db = createServiceClient()
    const { error } = await db.from('feature_flags').select('flag_name', { head: true, count: 'exact' }).limit(1)
    dbOk = !error
  } catch {
    dbOk = false
  }

  const body = {
    ok: dbOk,
    db: dbOk ? 'reachable' : 'unreachable',
    latency_ms: Date.now() - startedAt,
    time: new Date().toISOString(),
  }
  return NextResponse.json(body, { status: dbOk ? 200 : 503 })
}
