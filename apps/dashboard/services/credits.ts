import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { PlanId, PLANS, getPlanConfig, canGenerateVideo } from "@/lib/tiers";

export class CreditManager {
  // Lazily initialized so the client is only created at request time (not at
  // module load time), preventing build crashes on Cloudflare where
  // NEXT_PUBLIC_SUPABASE_URL is a runtime-only env var.
  private _db: SupabaseClient | null = null
  private get db(): SupabaseClient {
    if (!this._db) {
      this._db = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      )
    }
    return this._db
  }

  // ==========================================================
  // MONTHLY RESET (bulk)
  // Credits reset lazily per-user (see ensureFreshCredits) — no scheduler
  // needed. This bulk method remains for manual/admin use and includes
  // free-plan users.
  // ==========================================================
  async resetMonthlyCredits(): Promise<number> {
    const { data: users, error } = await this.db
      .from("profiles")
      .select("*")
      .or("monthly_reset_at.lt.now(),monthly_reset_at.is.null");

    if (error) {
      console.error("Error fetching users for reset:", error);
      return 0;
    }

    let resetCount = 0;
    for (const user of (users || [])) {
      const plan = getPlanConfig(user.plan as PlanId);

      await this.db
        .from("profiles")
        .update({
          videos_used_this_month: 0,
          videos_limit_this_month: plan.limits.videosPerMonth,
          overage_videos_this_month: 0,
          overage_cost_this_month: 0,
          monthly_reset_at: new Date().toISOString(),
        })
        .eq("id", user.id);

      // Log the allocation
      await this.db.from("credit_transactions").insert({
        user_id: user.id,
        type: "plan_renewal",
        videos_amount: plan.limits.videosPerMonth,
        videos_balance_after: plan.limits.videosPerMonth,
        description: `Monthly credit reset for ${plan.name} plan`,
      });

      resetCount++;
    }

    return resetCount;
  }

  // ==========================================================
  // LAZY MONTHLY RESET (no cron needed)
  // If the user's last reset was in a previous UTC month (or never), reset
  // their counters in place. Applies to every plan, including free.
  // ==========================================================
  private needsMonthlyReset(user: { monthly_reset_at: string | null }): boolean {
    const now = new Date();
    const monthStart = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1);
    if (!user.monthly_reset_at) return true;
    return new Date(user.monthly_reset_at).getTime() < monthStart;
  }

  private async ensureFreshCredits<T extends Record<string, any>>(user: T): Promise<T> {
    if (!this.needsMonthlyReset(user as any)) return user;

    const plan = getPlanConfig(user.plan as PlanId);
    const updates = {
      videos_used_this_month: 0,
      videos_limit_this_month: plan.limits.videosPerMonth,
      overage_videos_this_month: 0,
      overage_cost_this_month: 0,
      monthly_reset_at: new Date().toISOString(),
    };

    await this.db.from("profiles").update(updates).eq("id", user.id);
    await this.db.from("credit_transactions").insert({
      user_id: user.id,
      type: "plan_renewal",
      videos_amount: plan.limits.videosPerMonth,
      videos_balance_after: plan.limits.videosPerMonth,
      description: `Monthly credit reset for ${plan.name} plan`,
    });

    return { ...user, ...updates };
  }

  // ==========================================================
  // CHECK BEFORE GENERATION
  // ==========================================================
  async checkGenerationAllowed(params: {
    userId: string;
    resolution: "720p" | "1080p";
    wantsCustomPrompt: boolean;
    wantsBulk: boolean;
    bulkCount: number;
  }): Promise<{
    allowed: boolean;
    reason?: string;
    overageCost?: number; // cents
    remainingVideos: number;
  }> {
    const { data: user, error } = await this.db
      .from("profiles")
      .select("*")
      .eq("id", params.userId)
      .single();

    if (error || !user) throw new Error("User not found");

    // Lazy monthly reset — replaces the old scheduler.
    Object.assign(user, await this.ensureFreshCredits(user));

    // Check if trial expired
    if (user.trial_ends_at && new Date() > new Date(user.trial_ends_at)) {
      // Downgrade to free
      await this.db
        .from("profiles")
        .update({ plan: "free", videos_limit_this_month: PLANS.free.limits.videosPerMonth })
        .eq("id", params.userId);
        
      return {
        allowed: false,
        reason: "Your trial has ended. Please upgrade to continue.",
        remainingVideos: 0,
      };
    }

    const result = canGenerateVideo({
      planId: user.plan as PlanId,
      videosUsedThisMonth: user.videos_used_this_month || 0,
      currentResolution: params.resolution,
      wantsCustomPrompt: params.wantsCustomPrompt,
      wantsBulk: params.wantsBulk,
      bulkCount: params.bulkCount,
    });

    return {
      ...result,
      remainingVideos: Math.max(0, (user.videos_limit_this_month || 0) - (user.videos_used_this_month || 0)),
    };
  }

  // ==========================================================
  // DEDUCT CREDIT AFTER GENERATION
  // ==========================================================
  async deductCredit(userId: string, isOverage: boolean = false): Promise<void> {
    const { data: user, error } = await this.db
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single();
      
    if (error || !user) throw new Error("User not found");

    if (isOverage) {
      // Track overage
      const newOverageVideos = (user.overage_videos_this_month || 0) + 1;
      const newOverageCost = (user.overage_cost_this_month || 0) + 300; // $3.00
      
      await this.db
        .from("profiles")
        .update({
          overage_videos_this_month: newOverageVideos,
          overage_cost_this_month: newOverageCost,
        })
        .eq("id", userId);

      await this.db.from("credit_transactions").insert({
        user_id: userId,
        type: "overage_charge",
        videos_amount: -1,
        videos_balance_after: user.videos_used_this_month || 0,
        description: "Overage video generation ($3.00)",
      });
    } else {
      // Normal credit deduction
      const newUsed = (user.videos_used_this_month || 0) + 1;
      await this.db
        .from("profiles")
        .update({
          videos_used_this_month: newUsed,
        })
        .eq("id", userId);

      await this.db.from("credit_transactions").insert({
        user_id: userId,
        type: "free_allocation", // or plan_renewal, but this tracks usage
        videos_amount: -1,
        videos_balance_after: (user.videos_limit_this_month || 0) - newUsed,
        description: "Video generation",
      });
    }
  }

  // ==========================================================
  // HANDLE PLAN UPGRADE/DOWNGRADE
  // ==========================================================
  async handlePlanChange(userId: string, newPlan: PlanId): Promise<void> {
    const { data: user, error } = await this.db
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single();
      
    if (error || !user) throw new Error("User not found");

    const planConfig = getPlanConfig(newPlan);

    await this.db
      .from("profiles")
      .update({
        plan: newPlan,
        videos_limit_this_month: planConfig.limits.videosPerMonth,
        // Don't reset used count on upgrade — user keeps what they've used
        // But give them the new limit going forward
      })
      .eq("id", userId);

    await this.db.from("credit_transactions").insert({
      user_id: userId,
      type: "plan_renewal",
      videos_amount: planConfig.limits.videosPerMonth,
      videos_balance_after: planConfig.limits.videosPerMonth - (user.videos_used_this_month || 0),
      description: `Upgraded to ${planConfig.name} plan`,
    });
  }

  // ==========================================================
  // GRANT FREE TRIAL (Reverse Trial — Lovable Pattern)
  // ==========================================================
  async grantTrial(userId: string): Promise<void> {
    const { data: user, error } = await this.db
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single();
      
    if (error || !user || user.has_used_trial) return;

    // Give 30 days of Pro access
    const trialEnd = new Date();
    trialEnd.setDate(trialEnd.getDate() + 30);

    await this.db
      .from("profiles")
      .update({
        plan: "pro",
        videos_limit_this_month: PLANS.pro.limits.videosPerMonth,
        trial_ends_at: trialEnd.toISOString(),
        has_used_trial: true,
      })
      .eq("id", userId);

    await this.db.from("credit_transactions").insert({
      user_id: userId,
      type: "trial_grant",
      videos_amount: PLANS.pro.limits.videosPerMonth,
      videos_balance_after: PLANS.pro.limits.videosPerMonth,
      description: "30-day Pro trial granted",
    });
  }

  // ==========================================================
  // GET USAGE STATS
  // ==========================================================
  async getUsageStats(userId: string): Promise<{
    plan: PlanId;
    videosUsed: number;
    videosLimit: number;
    videosRemaining: number;
    overageVideos: number;
    overageCost: number;
    percentUsed: number;
    resetDate: Date;
  }> {
    const { data: user, error } = await this.db
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single();
      
    if (error || !user) throw new Error("User not found");

    // Lazy monthly reset so dashboards show renewed credits immediately.
    Object.assign(user, await this.ensureFreshCredits(user));

    const plan = getPlanConfig(user.plan as PlanId);
    const limit = user.videos_limit_this_month || 0;
    const used = user.videos_used_this_month || 0;
    const remaining = Math.max(0, limit - used);
    const percentUsed = limit > 0 ? (used / limit) * 100 : 0;

    // Calculate next reset date (1st of next month)
    const now = new Date();
    const resetDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    return {
      plan: (user.plan as PlanId) || "free",
      videosUsed: used,
      videosLimit: limit,
      videosRemaining: remaining,
      overageVideos: user.overage_videos_this_month || 0,
      overageCost: user.overage_cost_this_month || 0,
      percentUsed,
      resetDate,
    };
  }
}

export const creditManager = new CreditManager();
