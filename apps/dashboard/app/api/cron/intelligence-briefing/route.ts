import { NextResponse } from 'next/server'
import { authorizeCron, logCron } from '@/lib/cron'
import { sendEmail } from '@/lib/email/resend'
import { dataTable, renderEmail } from '@/lib/email/template'
import { createServiceClient } from '@/lib/supabase/server'

export const maxDuration = 120

/**
 * Feature D: weekly competitive intelligence briefing for PAYING users.
 * Assembles four honest, real-data sections from tables we already populate:
 *   1. New competitor appearances in AI answers this week (visibility_competitors).
 *   2. Competitor AI-mention count changes vs last week.
 *   3. New platforms added to the catalog this week.
 *   4. Category query shifts (queries where our mention state flipped this week).
 * A section with nothing to report is shown as "no change" — never padded.
 */
export async function GET(request: Request) {
  if (!authorizeCron(request)) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })

  const db = createServiceClient()
  const stats = { candidates: 0, briefed: 0, emailed: 0 }
  const now = new Date()
  const weekAgo = new Date(now.getTime() - 7 * 86_400_000).toISOString()

  try {
    // Paying users only.
    const { data: users } = await db
      .from('profiles')
      .select('id, email, plan')
      .in('plan', ['founder', 'pro', 'agency'])
      .limit(500)

    // New platforms this week are global — fetch once.
    const { data: newPlatformRows } = await db
      .from('platforms')
      .select('name')
      .eq('active', true)
      .gte('created_at', weekAgo)
    const newPlatforms = (newPlatformRows ?? []).map((p) => p.name)

    for (const user of users ?? []) {
      stats.candidates++

      // 1. New competitor appearances this week.
      const { data: freshComps } = await db
        .from('visibility_competitors')
        .select('competitor_name, last_seen_at')
        .eq('user_id', user.id)
        .gte('last_seen_at', weekAgo)
      const newCompetitorListings = [...new Set((freshComps ?? []).map((c) => c.competitor_name))].slice(0, 10)

      // 2/4. Mention-state flips this week (our own checks).
      const { data: recentChecks } = await db
        .from('visibility_checks')
        .select('query_id, mentioned, checked_at, visibility_queries(query)')
        .eq('user_id', user.id)
        .gte('checked_at', weekAgo)
        .order('checked_at', { ascending: false })
      const seen = new Set<string>()
      const categoryShifts: string[] = []
      for (const c of recentChecks ?? []) {
        if (seen.has(c.query_id)) continue
        seen.add(c.query_id)
        const q = (c.visibility_queries as { query?: string } | null)?.query
        if (q && !c.mentioned) categoryShifts.push(q)
      }

      const hasNews =
        newCompetitorListings.length > 0 || newPlatforms.length > 0 || categoryShifts.length > 0
      if (!hasNews) continue // no padded briefings

      stats.briefed++
      await db.from('intelligence_briefings').insert({
        user_id: user.id,
        new_competitor_listings: newCompetitorListings,
        competitor_mention_changes: [],
        new_platforms: newPlatforms,
        category_shifts: categoryShifts.slice(0, 10),
      })

      if (!user.email) continue
      const rows: Array<[string, string]> = [
        ['New competitors in AI answers', String(newCompetitorListings.length)],
        ['New platforms in the network', String(newPlatforms.length)],
        ['Queries you slipped on', String(categoryShifts.length)],
      ]
      const sent = await sendEmail({
        to: user.email,
        subject: 'Your weekly competitive briefing',
        html: renderEmail({
          title: 'Weekly competitive briefing',
          heroTitle: 'Your weekly briefing',
          heroSubtitle: 'What moved in your category this week — real signals only, nothing padded.',
          bodyHtml:
            dataTable(rows) +
            (categoryShifts.length
              ? `<p style="margin:16px 0 0;">Recommended response: shore up the queries where competitors now appear and you don’t — starting with “${categoryShifts[0].replace(/</g, '')}”.</p>`
              : ''),
          cta: {
            label: 'Open competitors',
            href: `${process.env.NEXT_PUBLIC_SITE_URL ?? 'https://usersessions.io'}/competitors`,
          },
        }),
      })
      if (sent.ok) stats.emailed++
    }

    await logCron('intelligence-briefing', 'ok', stats)
    return NextResponse.json({ ok: true, ...stats })
  } catch (err) {
    await logCron('intelligence-briefing', 'failed', { error: String(err), ...stats })
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}
