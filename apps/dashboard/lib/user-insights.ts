export type UserInsight = {
  id: string
  severity: 'info' | 'warning' | 'critical'
  text: string
  href?: string
}

/**
 * User-facing insights for the Overview (GAP 17). Pure function over data the
 * page already fetched — no extra queries, no fabricated numbers. The admin
 * equivalent lives in lib/insights.ts and uses the service client.
 */
export function computeUserInsights(input: {
  deadCount: number
  daysSinceLastLaunch: number | null
  mentionRate: number | null
  prevMentionRate: number | null
  usagePct: { label: string; pct: number }[]
}): UserInsight[] {
  const out: UserInsight[] = []

  if (input.deadCount > 0) {
    out.push({
      id: 'dead-listings',
      severity: 'critical',
      text: `${input.deadCount} listing${input.deadCount === 1 ? ' is' : 's are'} dead or removed — resubmit to recover distribution.`,
      href: '/listings?status=failed',
    })
  }

  if (input.daysSinceLastLaunch !== null && input.daysSinceLastLaunch >= 30) {
    out.push({
      id: 'stale-launch',
      severity: 'warning',
      text: `No launch in ${input.daysSinceLastLaunch} days — fresh launches keep listings alive and your score climbing.`,
      href: '/campaigns',
    })
  }

  if (input.mentionRate != null && input.prevMentionRate != null && input.mentionRate !== input.prevMentionRate) {
    const dropped = input.mentionRate < input.prevMentionRate
    out.push({
      id: dropped ? 'visibility-drop' : 'visibility-up',
      severity: dropped ? 'warning' : 'info',
      text: dropped
        ? `AI visibility dropped from ${input.prevMentionRate}% to ${input.mentionRate}% — check which queries stopped mentioning you.`
        : `AI visibility climbed from ${input.prevMentionRate}% to ${input.mentionRate}%.`,
      href: '/analytics',
    })
  }

  for (const u of input.usagePct) {
    if (u.pct >= 80) {
      out.push({
        id: `limit-${u.label.toLowerCase().replaceAll(' ', '-')}`,
        severity: u.pct >= 100 ? 'critical' : 'warning',
        text: `${u.label} at ${Math.round(u.pct)}% of your plan limit.`,
        href: '/pricing',
      })
    }
  }

  return out
}
