/**
 * Registry of scheduled jobs. The cron table on /admin renders from this list so every
 * job is visible even before its first run. Schedules mirror the deployment cron config.
 */
export type CronJob = { name: string; schedule: string; description: string; path: string }

export const CRON_JOBS: CronJob[] = [
  { name: 'link-check', schedule: '0 3 * * *', description: 'Verify live listings; start 48h grace windows on failures', path: '/api/cron/link-check' },
  { name: 'platform-quality', schedule: '0 4 * * *', description: 'Recompute Platform Quality Scores', path: '/api/cron/platform-quality' },
  { name: 'competitor-scan', schedule: '0 5 * * *', description: 'Scan tracked competitors', path: '/api/cron/competitor-scan' },
  { name: 'ai-visibility', schedule: '0 2 * * 0', description: 'Weekly AI visibility measurement', path: '/api/cron/ai-visibility' },
  { name: 'weekly-digest', schedule: '0 9 * * 1', description: 'Send weekly digest emails', path: '/api/cron/weekly-digest' },
]

// Minimal 5-field cron matcher — supports numbers and '*' only, which covers every
// schedule above. Extend before introducing ranges/steps.
function matches(expr: string, d: Date): boolean {
  const [m, h, dom, mon, dow] = expr.split(' ')
  const ok = (field: string, value: number) => field === '*' || Number(field) === value
  return (
    ok(m, d.getUTCMinutes()) &&
    ok(h, d.getUTCHours()) &&
    ok(dom, d.getUTCDate()) &&
    ok(mon, d.getUTCMonth() + 1) &&
    ok(dow, d.getUTCDay())
  )
}

/** Next UTC run time for a schedule, scanning forward minute-by-minute (max 8 days). */
export function nextRun(expr: string, from: Date = new Date()): Date | null {
  const d = new Date(from)
  d.setUTCSeconds(0, 0)
  d.setUTCMinutes(d.getUTCMinutes() + 1)
  for (let i = 0; i < 60 * 24 * 8; i++) {
    if (matches(expr, d)) return new Date(d)
    d.setUTCMinutes(d.getUTCMinutes() + 1)
  }
  return null
}
