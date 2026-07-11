import { NextResponse } from 'next/server'
import { authenticateBearer } from '@/lib/auth/bearer'
import { createServiceClient } from '@/lib/supabase/server'
import { planRank } from '@/lib/tiers'
import type { Surface } from '@usersessions/shared'

/**
 * GET /api/surfaces — the surface catalog for the extension "Distribute to Surfaces" flow.
 * Bearer-authed. Each surface is annotated with whether the caller's plan unlocks it, so
 * the extension can gate the UI without shipping tier logic.
 */
export async function GET(request: Request) {
  const user = await authenticateBearer(request)
  if (!user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })

  const db = createServiceClient()
  const [{ data: rows, error }, { data: profile }] = await Promise.all([
    db.from('surfaces').select('*').eq('active', true).order('quality_score', { ascending: false }),
    db.from('profiles').select('plan').eq('id', user.id).maybeSingle(),
  ])
  if (error) return NextResponse.json({ error: 'QUERY_FAILED' }, { status: 500 })

  const rank = planRank(profile?.plan)
  const surfaces = (rows ?? []).map((s) => ({
    surface: {
      id: s.id,
      name: s.name,
      category: s.category,
      urlPattern: s.url_pattern,
      submissionType: s.submission_type,
      qualityScore: s.quality_score,
      tierUnlock: s.tier_unlock,
    } satisfies Surface,
    unlocked: rank >= s.tier_unlock,
  }))

  return NextResponse.json({ ok: true, surfaces })
}
