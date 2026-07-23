import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { PLANS, type PlanId } from "@/lib/tiers";

// Force dynamic: Supabase URL is a runtime env var on Cloudflare, not a build var.
export const dynamic = 'force-dynamic'


// Keep in sync with COST_PER_VIDEO in lib/tiers.ts (Gemini + MiniMax + storage + bandwidth).
const COST_PER_VIDEO_USD = 0.37;

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const db = createServiceClient();
    const { data: me } = await db.from("profiles").select("role").eq("id", user.id).maybeSingle();
    if (me?.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const now = new Date();
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();

    // Actuals from the videos table (source of truth) + active paid plan rows.
    const [{ count: videosThisMonth }, { data: paidProfiles }] = await Promise.all([
      db.from("videos").select("*", { count: "exact", head: true }).gte("created_at", monthStart),
      db.from("profiles").select("plan").neq("plan", "free").eq("subscription_status", "active"),
    ]);

    let totalRevenue = 0;
    for (const p of paidProfiles ?? []) {
      const plan = PLANS[p.plan as PlanId];
      if (plan) totalRevenue += plan.price.monthly / 100;
    }

    const totalVideosGenerated = videosThisMonth ?? 0;
    const totalCost = totalVideosGenerated * COST_PER_VIDEO_USD;

    return NextResponse.json({
      totalVideosGenerated,
      totalRevenue,
      totalCost,
      totalProfit: totalRevenue - totalCost,
    });
  } catch (error: any) {
    console.error("Admin profitability error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
