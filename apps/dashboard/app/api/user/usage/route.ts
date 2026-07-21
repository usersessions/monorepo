import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { creditManager } from "@/services/credits";

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const usageStats = await creditManager.getUsageStats(user.id);
    return NextResponse.json(usageStats);
  } catch (error: any) {
    console.error("Usage stats error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
