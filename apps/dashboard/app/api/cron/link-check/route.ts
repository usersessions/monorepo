import { NextResponse } from 'next/server'
import { authorizeCron, logCron } from '@/lib/cron'
import { computeDistributionScore } from '@/lib/distribution-score'
import { createServiceClient } from '@/lib/supabase/server'
import { sendEmail } from '@/lib/email/resend'
import { ctaButton, dataTable, renderEmail } from '@/lib/email/template'
import type { PlanId } from '@usersessions/shared'

export const maxDuration = 60

const BATCH = 50
const GRACE_MS = 48 * 3600 * 1000 // 48h grace — BUILD_SPEC §9, non-negotiable
const UA = 'Mozilla/5.0 (compatible; usersessions-linkcheck/1.0; +https://usersessions.io)'

/**
 * Is the listing reachable? HEAD first, GET fallback (many hosts 405 HEAD), retry with backoff.
 * A network error or bot-block returns false, but the 48h grace window means a transient
 * failure NEVER produces a dead-link alert on its own.
 */
async function isAlive(url: string): Promise<boolean> {
  for (const method of ['HEAD', 'GET'] as const) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const res = await fetch(url, {
          method,
          redirect: 'follow',
          headers: { 'user-agent': UA },
          signal: AbortSignal.timeout(8000),
        })
        if (res.ok) return true
        if (res.status === 404 || res.status === 410) return false
        if (method === 'HEAD' && res.status === 405) break // fall through to GET
      } catch {
        // retry after backoff
      }
      await new Promise((r) => setTimeout(r, 500 * (attempt + 1)))
    }
  }
  return false
}

export async function GET(request: Request) {
  if (!authorizeCron(request)) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })

  const db = createServiceClient()
  const stats = { checked: 0, promoted: 0, graceStarted: 0, removed: 0, autoResubmitted: 0, newPlatformNotices: 0 }

  try {
    // Oldest-checked first so the whole corpus rotates through daily batches.
    const { data: subs } = await db
      .from('submissions')
      .select('id, campaign_id, user_id, status, listing_url, link_check_failing_since, platform_id, simulated, profiles(plan, notif_link_alerts)')
      .eq('simulated', false)
      .in('status', ['submitted', 'live', 'indexed'])
      .not('listing_url', 'is', null)
      .order('last_checked_at', { ascending: true, nullsFirst: true })
      .limit(BATCH)

    const now = new Date()
    const affectedCampaigns = new Set<string>()

    for (const sub of subs ?? []) {
      stats.checked++
      const alive = await isAlive(sub.listing_url!)

      if (alive) {
        const promote = sub.status === 'submitted' // reachable listing URL ⇒ live
        if (promote) {
          stats.promoted++
          affectedCampaigns.add(sub.campaign_id)
          const profile = sub.profiles as { plan?: PlanId; notif_link_alerts?: boolean } | null
          if (profile?.notif_link_alerts !== false) {
            const { data: p } = await db.from('profiles').select('email').eq('id', sub.user_id).maybeSingle()
            if (p?.email) {
              void sendEmail({
                to: p.email,
                subject: 'Your listing is live',
                html: renderEmail({
                  title: 'Listing live',
                  heroTitle: 'Listing is live',
                  heroSubtitle: `Your listing on ${sub.platform_id} is now verified reachable.`,
                  bodyHtml: dataTable([
                    ['Platform', sub.platform_id],
                    ['Status', 'Live and indexed'],
                  ]),
                  cta: { label: 'View listing', href: sub.listing_url! },
                }),
              })
            }
          }
        }
        await db
          .from('submissions')
          .update({
            status: promote ? 'live' : sub.status,
            link_check_failing_since: null,
            last_checked_at: now.toISOString(),
          })
          .eq('id', sub.id)
        continue
      }

      // Failing: start or continue the grace window.
      if (!sub.link_check_failing_since) {
        stats.graceStarted++
        await db
          .from('submissions')
          .update({ link_check_failing_since: now.toISOString(), last_checked_at: now.toISOString() })
          .eq('id', sub.id)
        continue
      }

      const failingMs = now.getTime() - new Date(sub.link_check_failing_since).getTime()
      if (failingMs < GRACE_MS) {
        await db.from('submissions').update({ last_checked_at: now.toISOString() }).eq('id', sub.id)
        continue
      }

      // Confirmed dead: 48h of continuous failure.
      const profile = sub.profiles as { plan?: PlanId; notif_link_alerts?: boolean } | null
      const plan = profile?.plan ?? 'free'

      if (plan === 'founder' || plan === 'agency') {
        // Auto-resubmit
        stats.autoResubmitted++
        affectedCampaigns.add(sub.campaign_id)
        await db
          .from('submissions')
          .update({ status: 'removed', last_checked_at: now.toISOString() })
          .eq('id', sub.id)

        // Queue a new submission
        await db.from('submissions').insert({
          campaign_id: sub.campaign_id,
          platform_id: sub.platform_id,
          user_id: sub.user_id,
          status: 'submitted',
          simulated: false,
        })

        if (profile?.notif_link_alerts !== false) {
          await db.from('notifications').insert({
            user_id: sub.user_id,
            kind: 'dead_link',
            title: 'Auto-resubmitted a dead listing',
            body: `${sub.listing_url} went dead, but your plan includes auto-resubmission. A new submission has been queued.`,
          })
        }
      } else {
        // Free plan: mark dead and notify
        stats.removed++
        affectedCampaigns.add(sub.campaign_id)
        await db
          .from('submissions')
          .update({ status: 'removed', last_checked_at: now.toISOString() })
          .eq('id', sub.id)
          
        if (profile?.notif_link_alerts !== false) {
          await db.from('notifications').insert({
            user_id: sub.user_id,
            kind: 'dead_link',
            title: 'A listing went dead',
            body: `${sub.listing_url} has been unreachable for 48 hours. Queue a resubmission from Listings.`,
          })
          const { data: p } = await db.from('profiles').select('email').eq('id', sub.user_id).maybeSingle()
          if (p?.email) {
            void sendEmail({
              to: p.email,
              subject: 'A listing was rejected or went dead',
              html: renderEmail({
                title: 'Listing needs attention',
                heroTitle: 'A listing needs attention',
                heroSubtitle: `${sub.platform_id} could not be reached for 48 hours.`,
                bodyHtml: dataTable([
                  ['Platform', sub.platform_id],
                  ['Reason', 'Unreachable for 48+ hours'],
                ]),
                cta: {
                  label: 'Fix and resubmit',
                  href: `${process.env.NEXT_PUBLIC_SITE_URL ?? 'https://usersessions.io'}/listings?status=removed`,
                },
              }),
            })
          }
        }
      }
    }

    // Recompute Distribution Scores for every affected product.
    if (affectedCampaigns.size > 0) {
      const { data: campaigns } = await db
        .from('campaigns')
        .select('user_id, product_id')
        .in('id', [...affectedCampaigns])
      const seen = new Set<string>()
      for (const c of campaigns ?? []) {
        const key = `${c.user_id}:${c.product_id}`
        if (seen.has(key)) continue
        seen.add(key)
        await computeDistributionScore(c.user_id, c.product_id)
      }
    }

    // New-platform drops: platforms activated in the last 24h → notify every user once.
    const dayAgo = new Date(Date.now() - 24 * 3600 * 1000).toISOString()
    const { data: newPlatforms } = await db
      .from('platforms')
      .select('name')
      .eq('active', true)
      .gte('created_at', dayAgo)
    if (newPlatforms && newPlatforms.length > 0) {
      const names = newPlatforms.map((p) => p.name).join(', ')
      const { data: users } = await db.from('profiles').select('id, notif_new_platforms').limit(500)
      for (const u of users ?? []) {
        if (u.notif_new_platforms !== false) {
          stats.newPlatformNotices++
          await db.from('notifications').insert({
            user_id: u.id,
            kind: 'new_platforms',
            title: `New platform${newPlatforms.length > 1 ? 's' : ''} in the network`,
            body: `${names} just joined the catalog. Launch again to get listed there too.`,
          })
        }
      }
    }

    await logCron('link-check', 'ok', stats)
    return NextResponse.json({ ok: true, ...stats })
  } catch (err) {
    await logCron('link-check', 'failed', { error: String(err), ...stats })
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}
