/**
 * Registry of scheduled jobs. The cron table on /admin renders from this list so every
 * job is visible even before its first run. Schedules mirror the deployment cron config.
 */
export type CronJob = { name: string; schedule: string; description: string; path: string }

export const CRON_JOBS: CronJob[] = [
  // Post-pivot there are no scheduled jobs: the legacy jobs were removed with
  // their routes, and monthly credit resets happen lazily per-user inside
  // CreditManager.ensureFreshCredits — no scheduler required.
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
