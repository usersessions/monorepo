import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { ShareOfVoiceEntry } from '@usersessions/shared'

/**
 * GET /api/visibility/competitors?productId=... — share-of-voice: the product vs the
 * competitors AI assistants recommend across its tracked queries. Owner-scoped via RLS.
 */
export async function GET(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })

  const productId = new URL(request.url).searchParams.get('productId')

  // Queries in scope + total count (denominator for share).
  let qb = supabase.from('visibility_queries').select('id, product_id, products(name)')
  if (productId) qb = qb.eq('product_id', productId)
  const { data: queries, error } = await qb
  if (error) return NextResponse.json({ error: 'QUERY_FAILED' }, { status: 500 })

  const queryIds = (queries ?? []).map((q) => q.id)
  const totalQueries = queryIds.length
  const productName =
    ((queries ?? [])[0]?.products as { name?: string } | null)?.name ?? 'Your product'

  if (totalQueries === 0) return NextResponse.json({ ok: true, shareOfVoice: [] })

  // Self mentions.
  const { data: selfChecks } = await supabase
    .from('visibility_checks')
    .select('query_id, mentioned, checked_at')
    .in('query_id', queryIds)
    .order('checked_at', { ascending: false })
  const selfLatest = new Map<string, boolean>()
  for (const c of selfChecks ?? []) if (!selfLatest.has(c.query_id)) selfLatest.set(c.query_id, Boolean(c.mentioned))
  const selfMentions = [...selfLatest.values()].filter(Boolean).length

  // Competitor appearances (denormalized).
  const { data: comps } = await supabase
    .from('visibility_competitors')
    .select('competitor_name, query_id')
    .in('query_id', queryIds)
  const byComp = new Map<string, Set<string>>()
  for (const c of comps ?? []) {
    const set = byComp.get(c.competitor_name) ?? new Set<string>()
    set.add(c.query_id)
    byComp.set(c.competitor_name, set)
  }

  const rows: ShareOfVoiceEntry[] = [
    {
      name: productName,
      isSelf: true,
      mentions: selfMentions,
      totalQueries,
      sharePct: Math.round((selfMentions / totalQueries) * 100),
    },
    ...[...byComp.entries()].map(([name, set]) => ({
      name,
      isSelf: false,
      mentions: set.size,
      totalQueries,
      sharePct: Math.round((set.size / totalQueries) * 100),
    })),
  ]
    .sort((a, b) => b.mentions - a.mentions)
    .slice(0, 4) // self + top 3 competitors

  return NextResponse.json({ ok: true, shareOfVoice: rows })
}
