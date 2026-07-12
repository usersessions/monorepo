import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { CommunityOpportunity, CommunitySurface } from '@usersessions/shared'

const SURFACES: CommunitySurface[] = ['indiehackers', 'stackoverflow', 'linkedin', 'hackernews', 'other']

/**
 * Community opportunities feed. GET returns the product's opportunities (RLS owner-scoped).
 * POST adds one manually (curated). A future automated scan can call POST server-side too.
 * Reddit is intentionally not an allowed surface (protects users' accounts from bans).
 */
export async function GET(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })

  const productId = new URL(request.url).searchParams.get('productId')
  let qb = supabase
    .from('community_opportunities')
    .select('id, surface, url, title, content_snippet, relevance_score, status, created_at')
    .order('created_at', { ascending: false })
    .limit(100)
  if (productId) qb = qb.eq('product_id', productId)
  const { data, error } = await qb
  if (error) return NextResponse.json({ error: 'QUERY_FAILED' }, { status: 500 })

  const opportunities: CommunityOpportunity[] = (data ?? []).map((o) => ({
    id: o.id,
    surface: o.surface as CommunitySurface,
    url: o.url,
    title: o.title,
    contentSnippet: o.content_snippet,
    relevanceScore: o.relevance_score,
    status: o.status,
    createdAt: o.created_at,
  }))
  return NextResponse.json({ ok: true, opportunities })
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })

  let body: { productId?: unknown; surface?: unknown; url?: unknown; title?: unknown; contentSnippet?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'INVALID_PAYLOAD' }, { status: 400 })
  }
  const productId = typeof body.productId === 'string' ? body.productId : ''
  const surface = SURFACES.includes(body.surface as CommunitySurface) ? (body.surface as CommunitySurface) : null
  const url = typeof body.url === 'string' ? body.url.trim().slice(0, 500) : ''
  const title = typeof body.title === 'string' ? body.title.trim().slice(0, 300) : ''
  const contentSnippet = typeof body.contentSnippet === 'string' ? body.contentSnippet.slice(0, 1000) : null
  if (!productId || !surface || !url || !title) return NextResponse.json({ error: 'INVALID_PAYLOAD' }, { status: 400 })

  // Ownership enforced by RLS with_check on insert.
  const { data: row, error } = await supabase
    .from('community_opportunities')
    .insert({ product_id: productId, user_id: user.id, surface, url, title, content_snippet: contentSnippet })
    .select('id')
    .single()
  if (error || !row) return NextResponse.json({ error: 'SAVE_FAILED' }, { status: 500 })
  return NextResponse.json({ ok: true, id: row.id })
}
