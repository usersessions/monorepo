import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { rateLimit } from '@/lib/rate-limit'
import type { PlatformVoteResponse } from '@usersessions/shared'

function bad(error: PlatformVoteResponse['error'], status: number): NextResponse {
  return NextResponse.json({ ok: false, error } satisfies PlatformVoteResponse, { status })
}

async function currentCount(db: ReturnType<typeof createServiceClient>, requestId: string): Promise<number | null> {
  const { data } = await db.from('platform_requests').select('vote_count').eq('id', requestId).maybeSingle()
  return data?.vote_count ?? null
}

/**
 * POST /api/platform-requests/[id]/vote — upsert one vote per user per request, then
 * recompute vote_count from the votes table (source of truth) rather than trusting a counter
 * increment, so counts can never drift under concurrent votes.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return bad('UNAUTHORIZED', 401)
  if (!rateLimit(`platformvote:${user.id}`, 30, 60_000)) return bad('RATE_LIMITED', 429)

  const db = createServiceClient()
  const { data: req } = await db.from('platform_requests').select('id').eq('id', id).maybeSingle()
  if (!req) return bad('NOT_FOUND', 404)

  await db.from('platform_request_votes').upsert({ request_id: id, user_id: user.id }, { onConflict: 'request_id,user_id' })
  const { count } = await db.from('platform_request_votes').select('*', { count: 'exact', head: true }).eq('request_id', id)
  const voteCount = count ?? (await currentCount(db, id)) ?? 0
  await db.from('platform_requests').update({ vote_count: voteCount, updated_at: new Date().toISOString() }).eq('id', id)

  return NextResponse.json({ ok: true, voteCount, hasVoted: true } satisfies PlatformVoteResponse)
}

/** DELETE /api/platform-requests/[id]/vote — remove the caller's own vote. */
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return bad('UNAUTHORIZED', 401)

  const db = createServiceClient()
  const { data: req } = await db.from('platform_requests').select('id').eq('id', id).maybeSingle()
  if (!req) return bad('NOT_FOUND', 404)

  await db.from('platform_request_votes').delete().eq('request_id', id).eq('user_id', user.id)
  const { count } = await db.from('platform_request_votes').select('*', { count: 'exact', head: true }).eq('request_id', id)
  const voteCount = count ?? 0
  await db.from('platform_requests').update({ vote_count: voteCount, updated_at: new Date().toISOString() }).eq('id', id)

  return NextResponse.json({ ok: true, voteCount, hasVoted: false } satisfies PlatformVoteResponse)
}
