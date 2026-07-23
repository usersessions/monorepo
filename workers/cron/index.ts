/**
 * Scheduled worker: calls the dashboard's cron routes on Cloudflare Cron Triggers.
 * Each trigger expression in wrangler.jsonc maps to an app route here — keep both
 * in sync with CRON_JOBS in apps/dashboard/lib/cron-jobs.ts.
 *
 * Secrets: `wrangler secret put CRON_SECRET` (must match the dashboard's CRON_SECRET).
 */
interface Env {
  BASE_URL: string;
  CRON_SECRET: string;
}

const JOBS: Record<string, string> = {
  "0 0 1 * *": "/api/cron/reset-credits",
};

export default {
  async scheduled(
    controller: { cron: string },
    env: Env,
    ctx: { waitUntil(promise: Promise<unknown>): void }
  ) {
    const path = JOBS[controller.cron];
    if (!path) {
      console.warn(`No job mapped for cron expression: ${controller.cron}`);
      return;
    }
    ctx.waitUntil(
      (async () => {
        const res = await fetch(`${env.BASE_URL}${path}`, {
          headers: { authorization: `Bearer ${env.CRON_SECRET}` },
        });
        const body = await res.text().catch(() => "");
        console.log(`cron ${path} → ${res.status} ${body.slice(0, 500)}`);
      })()
    );
  },
};
