import { NextResponse } from 'next/server'
import { authenticateBearer } from '@/lib/auth/bearer'
import { createClient, createServiceClient } from '@/lib/supabase/server'

/**
 * Per-adapter live-mode verification (migration 0020).
 * GET  — verification map for the caller. The extension calls this with a Bearer token
 *        at campaign start; the dashboard can call it with the session cookie.
 * POST — dashboard-only (session): mark/unmark one platform adapter as verified for
 *        this user. Verified adapters run LIVE in the extension; everything else
 *        stays in simulation.
 */

export async function GET(request: Request) {
  let userId: string | null = null
  const bearer = await authenticateBearer(request)
  if (bearer) {
    userId = bearer.id
  } else {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    userId = user?.id ?? null
  }
  if (!userId) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })

  const db = createServiceClient()
  const { data, error } = await db
    .from('adapter_verifications')
    .select('platform_id, verified')
    .eq('user_id', userId)
  if (error) return NextResponse.json({ error: 'FAILED' }, { status: 500 })

  const verifications: Record<string, boolean> = {}
  for (const row of data ?? []) verifications[row.platform_id] = Boolean(row.verified)
  return NextResponse.json({ verifications })
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })

  let body: { platformId?: string; verified?: boolean }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'INVALID_PAYLOAD' }, { status: 400 })
  }
  if (typeof body.platformId !== 'string' || typeof body.verified !== 'boolean') {
    return NextResponse.json({ error: 'INVALID_PAYLOAD' }, { status: 400 })
  }

  // User's own client on purpose: RLS guarantees they can only write their own rows.
  const { error } = await supabase.from('adapter_verifications').upsert(
    {
      user_id: user.id,
      platform_id: body.platformId,
      verified: body.verified,
      verified_at: body.verified ? new Date().toISOString() : null,
      verified_by: 'user',
    },
    { onConflict: 'user_id,platform_id' }
  )
  if (error) return NextResponse.json({ error: 'FAILED' }, { status: 400 })
  return NextResponse.json({ ok: true })
}
