import { NextResponse } from "next/server";
import { creditManager } from "@/services/credits";

export const maxDuration = 300;

/**
 * GET /api/cron/reset-credits — monthly credit reset (1st of month, 00:00 UTC).
 * Fail-closed bearer auth with CRON_SECRET; called by the Cloudflare scheduled
 * worker (workers/cron) or manually from /admin via the cron trigger.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET_NOT_CONFIGURED" }, { status: 503 });
  }
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  try {
    const resetCount = await creditManager.resetMonthlyCredits();
    return NextResponse.json({ ok: true, resetCount });
  } catch (err: any) {
    console.error("Credit reset cron failed:", err);
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
