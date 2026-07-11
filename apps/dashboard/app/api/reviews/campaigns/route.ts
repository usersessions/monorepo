import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { ReviewCampaignFunnel } from '@usersessions/shared'

/** GET /api/reviews/campaigns — the founder's review campaigns with funnel counts. */
export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })

  const { data: campaigns, error } = await supabase
    .from('review_campaigns')
    .select('id, status, created_at')
    .order('created_at', { ascending: false })
    .limit(50)
  if (error) return NextResponse.json({ error: 'QUERY_FAILED' }, { status: 500 })

  const ids = (campaigns ?? []).map((c) => c.id)
  const { data: requests } = ids.length
    ? await supabase.from('review_requests').select('review_campaign_id, status').in('review_campaign_id', ids)
    : { data: [] as any[] }

  const funnels: ReviewCampaignFunnel[] = (campaigns ?? []).map((c) => {
    const rows = (requests ?? []).filter((r) => r.review_campaign_id === c.id)
    const count = (statuses: string[]) => rows.filter((r) => statuses.includes(r.status)).length
    return {
      id: c.id,
      status: c.status,
      createdAt: c.created_at,
      total: rows.length,
      // Funnel is cumulative: a 'reviewed' row also counts as sent/opened/clicked.
      sent: count(['sent', 'opened', 'clicked', 'reviewed']),
      opened: count(['opened', 'clicked', 'reviewed']),
      clicked: count(['clicked', 'reviewed']),
      reviewed: count(['reviewed']),
    }
  })

  return NextResponse.json({ ok: true, campaigns: funnels })
}
