import { NextResponse } from 'next/server'
import { authorizeCron, logCron } from '@/lib/cron'
import { createServiceClient } from '@/lib/supabase/server'

export const maxDuration = 120

/**
 * Community opportunity scan (Feature 5). HONEST SOURCES ONLY: Stack Overflow + Hacker News,
 * both of which expose real public APIs. Reddit is excluded (bans real accounts), and Indie
 * Hackers / LinkedIn have no compliant public API, so those stay manual-add.
 * Matches each product's tracked visibility-query keywords against fresh questions/threads and
 * writes 'new' opportunities. Deduped by URL per product.
 */
async function searchStackOverflow(term: string): Promise<Array<{ url: string; title: string }>> {
  try {
    const res = await fetch(
      `https://api.stackexchange.com/2.3/search/advanced?order=desc&sort=creation&q=${encodeURIComponent(term)}&site=stackoverflow&pagesize=5`,
      { signal: AbortSignal.timeout(10_000) }
    )
    if (!res.ok) return []
    const json = await res.json()
    return (json?.items ?? [])
      .filter((i: any) => i?.link && i?.title)
      .map((i: any) => ({ url: String(i.link), title: String(i.title).slice(0, 300) }))
  } catch {
    return []
  }
}

async function searchHackerNews(term: string): Promise<Array<{ url: string; title: string }>> {
  try {
    const res = await fetch(
      `https://hn.algolia.com/api/v1/search_by_date?query=${encodeURIComponent(term)}&tags=(story,ask_hn)&hitsPerPage=5`,
      { signal: AbortSignal.timeout(10_000) }
    )
    if (!res.ok) return []
    const json = await res.json()
    return (json?.hits ?? [])
      .filter((h: any) => h?.objectID && (h?.title || h?.story_title))
      .map((h: any) => ({
        url: `https://news.ycombinator.com/item?id=${h.objectID}`,
        title: String(h.title ?? h.story_title).slice(0, 300),
      }))
  } catch {
    return []
  }
}

export async function GET(request: Request) {
  if (!authorizeCron(request)) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })

  const db = createServiceClient()
  const stats = { products: 0, found: 0, inserted: 0 }

  try {
    // Only scan for products whose owner is on a plan that can use community responses,
    // and that have at least one tracked visibility query to derive keywords from.
    const { data: queries } = await db
      .from('visibility_queries')
      .select('product_id, user_id, query, category_tag, profiles(plan)')
      .limit(300)

    // Group distinct search terms per product/user.
    const byProduct = new Map<string, { userId: string; terms: Set<string> }>()
    for (const q of queries ?? []) {
      const plan = (q.profiles as { plan?: string } | null)?.plan ?? 'free'
      if (plan === 'free') continue // paid feature
      const key = q.product_id
      const entry = byProduct.get(key) ?? { userId: q.user_id, terms: new Set<string>() }
      const term = (q.category_tag || q.query || '').toString().slice(0, 80)
      if (term) entry.terms.add(term)
      byProduct.set(key, entry)
    }

    for (const [productId, { userId, terms }] of byProduct) {
      stats.products++
      const term = [...terms][0]
      if (!term) continue

      const hits = [
        ...(await searchStackOverflow(term)).map((h) => ({ ...h, surface: 'stackoverflow' as const })),
        ...(await searchHackerNews(term)).map((h) => ({ ...h, surface: 'hackernews' as const })),
      ]
      stats.found += hits.length

      for (const h of hits) {
        // Dedupe by URL within this product.
        const { data: existing } = await db
          .from('community_opportunities')
          .select('id')
          .eq('product_id', productId)
          .eq('url', h.url)
          .maybeSingle()
        if (existing) continue
        await db.from('community_opportunities').insert({
          product_id: productId,
          user_id: userId,
          surface: h.surface,
          url: h.url,
          title: h.title,
          relevance_score: 60,
          status: 'new',
        })
        stats.inserted++
      }
    }

    await logCron('community-scan', 'ok', stats)
    return NextResponse.json({ ok: true, ...stats })
  } catch (err) {
    await logCron('community-scan', 'failed', { error: String(err), ...stats })
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}
