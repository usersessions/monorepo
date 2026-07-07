import { NextResponse } from 'next/server'
import { authorizeCron, logCron } from '@/lib/cron'
import { sendEmail } from '@/lib/email/resend'
import { sendPush } from '@/lib/push'
import { createServiceClient } from '@/lib/supabase/server'

export const maxDuration = 60

/**
 * Automated competitor scans. Triggered daily by pg_cron; each user's actual cadence
 * is gated by their (Paystack-backed) plan. A watch is only re-scanned once its
 * interval has elapsed, so the daily trigger is cheap.
 */
const SCAN_INTERVAL_DAYS: Record<string, number> = { free: 30, founder: 7, agency: 1 }

const GEMINI_URL =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent'

interface ScanResult {
  mentioned: boolean
  rank: number | null
  snippet: string | null
}

// Same honest prompt as the manual scanner: recommend first, then report truthfully.
async function runScan(query: string, name: string, url: string, key: string): Promise<ScanResult | null> {
  const prompt = [
    `A user asks an AI assistant: \"${query}\"`,
    'Answer the question genuinely first: list the tools/products you would actually recommend, best first.',
    `Then report honestly whether \"${name}\" (${url}) appeared in YOUR OWN list above.`,
    'Do not add it if it was not genuinely in your recommendations.',
    'Respond with ONLY JSON: {\"recommendations\":[\"...\"],\"mentioned\":boolean,\"rank\":number|null,\"snippet\":\"the exact sentence mentioning it, or null\"}',
  ].join('\n')

  try {
    const res = await fetch(`${GEMINI_URL}?key=${key}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: 'application/json', temperature: 0.3 },
      }),
      signal: AbortSignal.timeout(20_000),
    })
    if (!res.ok) return null
    const payload = await res.json()
    const parsed = JSON.parse(payload?.candidates?.[0]?.content?.parts?.[0]?.text ?? '{}')
    return {
      mentioned: Boolean(parsed.mentioned),
      rank: typeof parsed.rank === 'number' ? parsed.rank : null,
      snippet: typeof parsed.snippet === 'string' ? parsed.snippet.slice(0, 500) : null,
    }
  } catch {
    return null // one flaky scan never sinks the batch
  }
}

export async function GET(request: Request) {
  if (!authorizeCron(request)) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })

  const db = createServiceClient()
  const stats = { watches: 0, scanned: 0, emailed: 0, pushed: 0 }
  const key = process.env.GEMINI_API_KEY

  try {
    const { data: watches } = await db
      .from('competitor_watches')
      .select('*')
      .eq('active', true)
      .limit(200)

    if (!watches?.length || !key) {
      await logCron('competitor-scan', 'ok', { ...stats, skipped: !key ? 'no GEMINI_API_KEY' : 'no watches' })
      return NextResponse.json({ ok: true, ...stats })
    }

    const userIds = [...new Set(watches.map((w) => w.user_id))]
    const { data: profiles } = await db.from('profiles').select('id, email, plan').in('id', userIds)
    const profileById = new Map((profiles ?? []).map((p) => [p.id, p]))

    const resultsByUser = new Map<string, Array<{ query: string; name: string; result: ScanResult }>>()

    for (const watch of watches) {
      stats.watches++
      const profile = profileById.get(watch.user_id)
      if (!profile) continue

      // Plan-gated cadence: only scan once the user's interval has elapsed.
      const intervalDays = SCAN_INTERVAL_DAYS[profile.plan] ?? SCAN_INTERVAL_DAYS.free
      const { data: last } = await db
        .from('competitor_scans')
        .select('scanned_at')
        .eq('watch_id', watch.id)
        .order('scanned_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (last && Date.now() - new Date(last.scanned_at).getTime() < intervalDays * 86_400_000) continue

      const result = await runScan(watch.query, watch.competitor_name, watch.competitor_url, key)
      if (!result) continue

      await db.from('competitor_scans').insert({
        user_id: watch.user_id,
        watch_id: watch.id,
        query: watch.query,
        competitor_name: watch.competitor_name,
        competitor_url: watch.competitor_url,
        engine: 'gemini',
        ...result,
      })
      stats.scanned++

      const bucket = resultsByUser.get(watch.user_id) ?? []
      bucket.push({ query: watch.query, name: watch.competitor_name, result })
      resultsByUser.set(watch.user_id, bucket)
    }

    // Notification pipeline: in-app row → Resend email → Web Push, per user with fresh results.
    for (const [userId, rows] of resultsByUser) {
      const profile = profileById.get(userId)
      if (!profile) continue

      await db.from('notifications').insert({
        user_id: userId,
        kind: 'competitor_scan',
        title: 'Competitor scan complete',
        body: `${rows.length} competitor ${rows.length === 1 ? 'query' : 'queries'} re-checked. See Competitors for details.`,
      })

      const tableRows = rows
        .map(
          (r) =>
            `<tr><td style=\"padding:4px 12px 4px 0\">${r.query}</td><td>${r.name}</td><td><strong>${
              r.result.mentioned ? `mentioned${r.result.rank ? ` (#${r.result.rank})` : ''}` : 'not mentioned'
            }</strong></td></tr>`
        )
        .join('')
      const html = [
        '<div style=\"font-family:Georgia,serif;max-width:520px\">',
        '<p style=\"font-style:italic;font-size:18px\">usersessions</p>',
        '<h2 style=\"font-weight:normal\">Competitor scan results</h2>',
        `<table style=\"font-family:monospace;font-size:14px\"><tr><th align=\"left\">Query</th><th align=\"left\">Competitor</th><th align=\"left\">Result</th></tr>${tableRows}</table>`,
        `<p><a href=\"${process.env.NEXT_PUBLIC_SITE_URL ?? 'https://usersessions.io'}/competitors\">See full snippets</a></p>`,
        '<p style=\"color:#888;font-size:12px\">Get your product found — usersessions.io</p>',
        '</div>',
      ].join('')
      if ((await sendEmail({ to: profile.email, subject: 'Competitor scan results', html })).ok) stats.emailed++

      const { data: subs } = await db.from('push_subscriptions').select('*').eq('user_id', userId)
      for (const sub of subs ?? []) {
        const push = await sendPush(sub, {
          title: 'Competitor scan complete',
          body: `${rows.length} ${rows.length === 1 ? 'result' : 'results'} ready`,
          url: '/competitors',
        })
        if (push.ok) stats.pushed++
        if (push.gone) await db.from('push_subscriptions').delete().eq('id', sub.id) // prune dead endpoints
      }
    }

    await logCron('competitor-scan', 'ok', stats)
    return NextResponse.json({ ok: true, ...stats })
  } catch (err) {
    await logCron('competitor-scan', 'failed', { error: String(err), ...stats })
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}
