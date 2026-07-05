import { createServiceClient } from './supabase/server'

/**
 * Cron auth: Vercel Cron sends `Authorization: Bearer $CRON_SECRET` automatically when the
 * CRON_SECRET env var is set. FAIL CLOSED: no secret configured means no cron runs.
 */
export function authorizeCron(request: Request): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  return request.headers.get('authorization') === `Bearer ${secret}`
}

/** Every cron writes its outcome here; /admin/system (M12) reads last-run status from it. */
export async function logCron(jobName: string, status: 'ok' | 'failed', detail?: unknown): Promise<void> {
  try {
    const db = createServiceClient()
    await db.from('cron_logs').insert({ job_name: jobName, status, detail: detail ?? null })
  } catch (err) {
    console.error('[cron] failed to log run:', err)
  }
}
