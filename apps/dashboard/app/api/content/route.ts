import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import type { ContentType, GeneratedContentView } from '@usersessions/shared'

const TYPES: ContentType[] = ['vs_page', 'best_tools_roundup', 'alternative_post', 'faq_page']

/** GET /api/content?productId= — saved content records (owner-scoped via RLS). */
export async function GET(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })

  const productId = new URL(request.url).searchParams.get('productId')
  let qb = supabase
    .from('generated_content')
    .select('id, content_type, draft_markdown, published_url, ai_citation_count, created_at')
    .order('created_at', { ascending: false })
    .limit(50)
  if (productId) qb = qb.eq('product_id', productId)
  const { data, error } = await qb
  if (error) return NextResponse.json({ error: 'QUERY_FAILED' }, { status: 500 })

  const items: GeneratedContentView[] = (data ?? []).map((r) => ({
    id: r.id,
    contentType: r.content_type as ContentType,
    draftMarkdown: r.draft_markdown,
    publishedUrl: r.published_url,
    aiCitationCount: r.ai_citation_count,
    createdAt: r.created_at,
  }))
  return NextResponse.json({ ok: true, items })
}

/** POST /api/content — save a generated draft (and optional published URL). */
export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })

  let body: { productId?: unknown; contentType?: unknown; draftMarkdown?: unknown; publishedUrl?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'INVALID_PAYLOAD' }, { status: 400 })
  }
  const productId = typeof body.productId === 'string' ? body.productId : ''
  const contentType = TYPES.includes(body.contentType as ContentType) ? (body.contentType as ContentType) : null
  const draftMarkdown = typeof body.draftMarkdown === 'string' ? body.draftMarkdown.slice(0, 20_000) : ''
  const publishedUrl = typeof body.publishedUrl === 'string' && body.publishedUrl.trim() ? body.publishedUrl.trim().slice(0, 500) : null
  if (!productId || !contentType || !draftMarkdown) return NextResponse.json({ error: 'INVALID_PAYLOAD' }, { status: 400 })

  const db = createServiceClient()
  const { data: product } = await db.from('products').select('user_id').eq('id', productId).maybeSingle()
  if (!product || product.user_id !== user.id) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 403 })

  const { data: row, error } = await db
    .from('generated_content')
    .insert({ product_id: productId, user_id: user.id, content_type: contentType, draft_markdown: draftMarkdown, published_url: publishedUrl })
    .select('id')
    .single()
  if (error || !row) return NextResponse.json({ error: 'SAVE_FAILED' }, { status: 500 })
  return NextResponse.json({ ok: true, id: row.id })
}
