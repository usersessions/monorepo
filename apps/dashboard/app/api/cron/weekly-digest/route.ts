import { NextResponse } from 'next/server'
import { authorizeCron, logCron } from '@/lib/cron'
import { sendEmail } from '@/lib/email/resend'
import { metricCard, renderEmail } from '@/lib/email/template'
import { createServiceClient } from '@/lib/supabase/server'

export const maxDuration = 60

const LIVE = ['live', 'indexed']

/**
 * Weekly digest (BUILD_SPEC §9): only real numbers from the user's own week — a week with
 * nothing to report sends nothing (never a padded email pretending there was progress).
 */
export async function GET(request: Request) {
  if (!authorizeCron(request)) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })

  const db = createServiceClient()
  const stats = { candidates: 0, sent: 0 }
  const weekAgo = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString()

  try {
    const { data: users } = await db
      .from('profiles')
      .select('id, email, notif_weekly_digest')
      .eq('notif_weekly_digest', true)
      .limit(100)

    for (const user of users ?? []) {
      stats.candidates++

      const [{ data: weekSubs }, { data: latestScore }, { count: deadCount }] = await Promise.all([
        db
          .from('submissions')
          .select('status, simulated, created_at')
          .eq('user_id', user.id)
          .eq('simulated', false)
          .gte('created_at', weekAgo),
        db
          .from('distribution_scores')
          .select('score, computed_at')
          .eq('user_id', user.id)
          .order('computed_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
        db
          .from('notifications')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .eq('kind', 'dead_link')
          .gte('created_at', weekAgo),
      ])

      const newLive = (weekSubs ?? []).filter((s) => LIVE.includes(s.status)).length
      const newTotal = (weekSubs ?? []).length
      const dead = deadCount ?? 0

      // Nothing happened → no email. An empty digest erodes trust faster than silence.
      if (newTotal === 0 && dead === 0) continue

      const body = [
        latestScore ? metricCard('Distribution Score', String(latestScore.score)) : '',
        newTotal > 0
          ? metricCard('New submissions this week', String(newTotal), { text: `${newLive} live`, positive: newLive > 0 })
          : '',
        dead > 0 ? metricCard('Listings gone dead', String(dead), { text: 'resubmit from Listings', positive: false }) : '',
      ].join('')
      const html = renderEmail({
        title: 'Your week in distribution',
        heroTitle: 'Your week in distribution',
        heroSubtitle: 'Only real numbers from your own week — nothing padded, nothing invented.',
        bodyHtml: body,
        cta: { label: 'Open your dashboard', href: process.env.NEXT_PUBLIC_SITE_URL ?? 'https://usersessions.io' },
      })

      const result = await sendEmail({ to: user.email, subject: 'Your week in distribution', html })
      if (result.ok) stats.sent++
    }

    await logCron('weekly-digest', 'ok', stats)
    return NextResponse.json({ ok: true, ...stats })
  } catch (err) {
    await logCron('weekly-digest', 'failed', { error: String(err), ...stats })
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}
