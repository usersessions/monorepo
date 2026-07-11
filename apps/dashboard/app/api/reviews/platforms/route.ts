import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { planRank } from '@/lib/tiers'
import type { ReviewPlatform } from '@usersessions/shared'

/** GET /api/reviews/platforms — review platform catalog, tier-annotated for the caller. */
export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })

  const [{ data: rows, error }, { data: profile }] = await Promise.all([
    supabase.from('review_platforms').select('*').eq('active', true).order('quality_score', { ascending: false }),
    supabase.from('profiles').select('plan').eq('id', user.id).maybeSingle(),
  ])
  if (error) return NextResponse.json({ error: 'QUERY_FAILED' }, { status: 500 })

  const rank = planRank(profile?.plan)
  const platforms = (rows ?? []).map((p) => ({
    platform: {
      id: p.id,
      name: p.name,
      url: p.url,
      category: p.category,
      qualityScore: p.quality_score,
      tierUnlock: p.tier_unlock,
    } satisfies ReviewPlatform,
    unlocked: rank >= p.tier_unlock,
  }))
  return NextResponse.json({ ok: true, platforms })
}
