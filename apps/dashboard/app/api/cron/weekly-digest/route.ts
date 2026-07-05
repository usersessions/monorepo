import { NextResponse } from 'next/server'
import { authorizeCron, logCron } from '@/lib/cron'
import { sendEmail } from '@/lib/email/resend'
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
    const { data: users } = await db.from('profiles').select('id, email').limit(100)

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

      const rows: string[] = []
      if (latestScore) rows.push(`<tr><td style="padding:4px 12px 4px 0">Distribution Score</td><td><strong>${latestScore.score}</strong></td></tr>`)
      if (newTotal > 0) rows.push(`<tr><td style="padding:4px 12px 4px 0">New submissions this week</td><td><strong>${newTotal}</strong> (${newLive} live)</td></tr>`)
      if (dead > 0) rows.push(`<tr><td style="padding:4px 12px 4px 0">Listings that went dead</td><td><strong>${dead}</strong> — resubmit from Listings</td></tr>`)

      const html = [
        '<div style="font-family:Georgia,serif;max-width:520px">',
        '<p style="font-style:italic;font-size:18px">usersessions</p>',
        '<h2 style="font-weight:normal">Your week in distribution</h2>',
        `<table style="font-family:monospace;font-size:14px">${rows.join('')}</table>`,
        `<p><a href="${process.env.NEXT_PUBLIC_SITE_URL ?? 'https://beta.usersessions.io'}">Open your dashboard</a></p>`,
        '<p style="color:#888;font-size:12px">Get your product found — usersessions.io</p>',
        '</div>',
      ].join('')

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
