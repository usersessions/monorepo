import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { VisibilityQuerySummary, VisibilityQueryType } from '@usersessions/shared'

/**
 * GET /api/visibility/queries?productId=... — tracked queries + their latest check,
 * owner-scoped via RLS. Feature B read model.
 */
export async function GET(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })

  const productId = new URL(request.url).searchParams.get('productId')
  let qb = supabase.from('visibility_queries').select('id, product_id, query, query_type, category_tag')
  if (productId) qb = qb.eq('product_id', productId)
  const { data: queries, error } = await qb
  if (error) return NextResponse.json({ error: 'QUERY_FAILED' }, { status: 500 })

  const ids = (queries ?? []).map((q) => q.id)
  const { data: checks } = ids.length
    ? await supabase
        .from('visibility_checks')
        .select('query_id, engine, mentioned, rank, snippet, checked_at')
        .in('query_id', ids)
        .order('checked_at', { ascending: false })
    : { data: [] as any[] }

  const latestByQuery = new Map<string, any>()
  for (const c of checks ?? []) if (!latestByQuery.has(c.query_id)) latestByQuery.set(c.query_id, c)

  const summaries: VisibilityQuerySummary[] = (queries ?? []).map((q) => {
    const latest = latestByQuery.get(q.id)
    return {
      id: q.id,
      query: q.query,
      queryType: (q.query_type as VisibilityQueryType) ?? 'category_direct',
      categoryTag: q.category_tag ?? null,
      mentioned: latest ? Boolean(latest.mentioned) : null,
      rank: latest?.rank ?? null,
      snippet: latest?.snippet ?? null,
      engine: latest?.engine ?? null,
      checkedAt: latest?.checked_at ?? null,
    }
  })

  return NextResponse.json({ ok: true, queries: summaries })
}
