import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // In a real implementation, you would verify if the user is an admin here.
    
    const now = new Date();
    const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

    const { data: usageStats, error } = await supabase
      .from("monthly_usage")
      .select("*")
      .eq("year_month", yearMonth);

    if (error) throw error;

    let totalVideosGenerated = 0;
    let totalRevenueCents = 0;
    let totalCostCents = 0;

    usageStats?.forEach(stat => {
      totalVideosGenerated += stat.videos_generated || 0;
      totalRevenueCents += (stat.subscription_revenue_cents || 0) + (stat.overage_revenue_cents || 0);
      totalCostCents += stat.estimated_cost_cents || 0;
    });

    return NextResponse.json({
      totalVideosGenerated,
      totalRevenue: totalRevenueCents / 100,
      totalCost: totalCostCents / 100,
      totalProfit: (totalRevenueCents - totalCostCents) / 100,
    });
  } catch (error: any) {
    console.error("Admin profitability error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
