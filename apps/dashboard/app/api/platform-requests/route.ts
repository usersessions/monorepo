import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { rateLimit } from '@/lib/rate-limit'
import { trackFeatureServer } from '@/lib/tracking'
import type {
  CreatePlatformRequestInput,
  PlatformRequest,
  PlatformRequestCategory,
  PlatformRequestListResponse,
  PlatformRequestResponse,
} from '@usersessions/shared'

const CATEGORIES: PlatformRequestCategory[] = ['ai', 'startup', 'saas', 'dev', 'marketplace', 'other']

function bad(error: PlatformRequestResponse['error'], status: number): NextResponse {
  return NextResponse.json({ ok: false, error } satisfies PlatformRequestResponse, { status })
}

function toView(row: Record<string, unknown>, hasVoted: boolean): PlatformRequest {
  return {
    id: row.id as string,
    name: row.name as string,
    url: (row.url as string | null) ?? null,
    category: row.category as PlatformRequestCategory,
    description: (row.description as string | null) ?? null,
    requesterId: (row.requester_id as string | null) ?? null,
    status: row.status as PlatformRequest['status'],
    voteCount: row.vote_count as number,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
    hasVoted,
  }
}

/**
 * GET /api/platform-requests — public board. Adds has_voted for the current caller when signed in.
 */
export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const db = createServiceClient()
  const { data: requests, error } = await db
    .from('platform_requests')
    .select('*')
    .order('vote_count', { ascending: false })
    .limit(200)
  if (error) {
    // Honest empty state if the migration hasn't been applied yet — never a 500 on a public page.
    return NextResponse.json({ ok: true, requests: [] } satisfies PlatformRequestListResponse)
  }

  let votedIds = new Set<string>()
  if (user) {
    const { data: votes } = await db.from('platform_request_votes').select('request_id').eq('user_id', user.id)
    votedIds = new Set((votes ?? []).map((v) => v.request_id))
  }

  return NextResponse.json({
    ok: true,
    requests: (requests ?? []).map((r) => toView(r, votedIds.has(r.id))),
  } satisfies PlatformRequestListResponse)
}

/**
 * POST /api/platform-requests — create a request and auto-cast the requester's own vote.
 * Unique(name) is enforced at the DB level; a duplicate returns DUPLICATE_NAME so the UI
 * can point the user at the existing request instead of silently failing.
 */
export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return bad('UNAUTHORIZED', 401)
  if (!rateLimit(`platformrequest:${user.id}`, 5, 60_000)) return bad('RATE_LIMITED', 429)

  let body: Partial<CreatePlatformRequestInput>
  try {
    body = await request.json()
  } catch {
    return bad('INVALID_PAYLOAD', 400)
  }
  const name = typeof body.name === 'string' ? body.name.trim().slice(0, 120) : ''
  const url = typeof body.url === 'string' ? body.url.trim().slice(0, 500) : ''
  const category = CATEGORIES.includes(body.category as PlatformRequestCategory) ? (body.category as PlatformRequestCategory) : null
  const description = typeof body.description === 'string' ? body.description.trim().slice(0, 500) : ''
  if (!name || !category) return bad('INVALID_PAYLOAD', 400)
  if (url) {
    try {
      // eslint-disable-next-line no-new
      new URL(/^https?:\/\//i.test(url) ? url : `https://${url}`)
    } catch {
      return bad('INVALID_PAYLOAD', 400)
    }
  }

  const db = createServiceClient()
  const { data: row, error } = await db
    .from('platform_requests')
    .insert({
      name,
      url: url || null,
      category,
      description: description || null,
      requester_id: user.id,
      vote_count: 1,
    })
    .select('*')
    .single()

  if (error) {
    // 23505 = unique_violation on name.
    if ((error as { code?: string }).code === '23505') return bad('DUPLICATE_NAME', 409)
    return bad('INVALID_PAYLOAD', 400)
  }

  await db.from('platform_request_votes').insert({ request_id: row.id, user_id: user.id })
  trackFeatureServer(user.id, 'platform_browse', 'submit', { metadata: { requestId: row.id } })

  return NextResponse.json({ ok: true, request: toView(row, true) } satisfies PlatformRequestResponse)
}
