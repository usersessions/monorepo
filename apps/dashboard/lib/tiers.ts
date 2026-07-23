export type PlanId = "free" | "starter" | "pro" | "agency";

export interface PlanConfig {
  id: PlanId;
  name: string;
  tagline: string;
  price: {
    monthly: number;      // USD cents (e.g., 2900 = $29.00)
    annual: number;       // USD cents with ~20% discount
    annualDiscount: string; // Display text: "Save 20%"
  };
  limits: {
    videosPerMonth: number;      // Hard cap. No rollover.
    maxVideoDuration: number;    // Seconds (6 for all plans)
    maxResolution: "720p" | "1080p";
    watermark: boolean;
    customPrompts: boolean;
    priorityQueue: boolean;
    bulkGeneration: boolean;     // Generate multiple at once
    apiAccess: boolean;
    teamSeats: number;
    whiteLabel: boolean;
  };
  features: string[]; // For pricing page display
  cta: string;
  popular?: boolean;
}

// ==========================================================
// COST ANALYSIS (Internal — never exposed to users)
// ==========================================================
const COST_PER_VIDEO = {
  geminiPrompt: 0.015,      // ~$0.015 per prompt generation
  minimaxGeneration: 0.33,  // ~$0.33 per 6s 1080p video via MiniMax directly
  storage: 0.005,           // ~$0.005 per video stored on R2
  bandwidth: 0.02,          // ~$0.02 per video streamed
  total: 0.37,              // Total COGS per video
};

// Margin targets: adjusted for new aggressive pricing
const MARGIN_TARGETS = {
  free: -1,        // Loss leader, capped at 3 videos
  starter: 0.72,   // 72% margin
  pro: 0.64,       // 64% margin
  agency: 0.53,    // 53% margin
};

// ==========================================================
// PLAN DEFINITIONS
// ==========================================================

export const PLANS: Record<PlanId, PlanConfig> = {
  free: {
    id: "free",
    name: "Free",
    tagline: "Try before you buy",
    price: {
      monthly: 0,
      annual: 0,
      annualDiscount: "",
    },
    limits: {
      videosPerMonth: 3,
      maxVideoDuration: 10,
      maxResolution: "720p",
      watermark: true,
      customPrompts: false,
      priorityQueue: false,
      bulkGeneration: false,
      apiAccess: false,
      teamSeats: 1,
      whiteLabel: false,
    },
    features: [
      "3 video generations per month",
      "720p export quality",
      "AI watermark on videos",
      "Shopify URL support",
      "TikTok format",
    ],
    cta: "Get Started Free",
  },

  starter: {
    id: "starter",
    name: "Starter",
    tagline: "For solo founders & small shops",
    price: {
      monthly: 1900,      // $19.00
      annual: 18200,      // $15.16/month billed annually = $182.00/year (save ~20%)
      annualDiscount: "Save 20%",
    },
    limits: {
      videosPerMonth: 15,
      maxVideoDuration: 10,
      maxResolution: "1080p",
      watermark: false,
      customPrompts: false,
      priorityQueue: false,
      bulkGeneration: false,
      apiAccess: false,
      teamSeats: 1,
      whiteLabel: false,
    },
    features: [
      "15 video generations per month",
      "1080p export quality",
      "No watermark",
      "All platforms: Shopify, Etsy, Amazon",
      "All formats: TikTok, Instagram, Facebook",
      "Email support",
    ],
    cta: "Upgrade to Starter",
    popular: true,
  },

  pro: {
    id: "pro",
    name: "Pro",
    tagline: "For growing brands & content teams",
    price: {
      monthly: 4900,      // $49.00
      annual: 47000,      // $39.16/month billed annually
      annualDiscount: "Save 20%",
    },
    limits: {
      videosPerMonth: 50,
      maxVideoDuration: 10,
      maxResolution: "1080p",
      watermark: false,
      customPrompts: true,
      priorityQueue: true,
      bulkGeneration: true,     // Generate up to 5 at once
      apiAccess: true,
      teamSeats: 3,
      whiteLabel: false,
    },
    features: [
      "50 video generations per month",
      "1080p export quality",
      "No watermark",
      "Custom AI prompts",
      "Priority generation queue",
      "Bulk generation (5 at once)",
      "API access",
      "3 team seats",
      "Priority support",
    ],
    cta: "Upgrade to Pro",
  },

  agency: {
    id: "agency",
    name: "Agency",
    tagline: "For agencies managing multiple clients",
    price: {
      monthly: 0,         // Custom — negotiated per client
      annual: 0,          // Custom — negotiated per client
      annualDiscount: "Custom",
    },
    limits: {
      videosPerMonth: 200,
      maxVideoDuration: 10,
      maxResolution: "1080p",
      watermark: false,
      customPrompts: true,
      priorityQueue: true,
      bulkGeneration: true,     // Generate up to 20 at once
      apiAccess: true,
      teamSeats: 10,
      whiteLabel: true,
    },
    features: [
      "200 video generations per month",
      "1080p export quality",
      "No watermark",
      "Custom AI prompts",
      "Priority generation queue",
      "Bulk generation (20 at once)",
      "API access",
      "10 team seats",
      "White-label exports",
      "Dedicated account manager",
    ],
    cta: "Contact Sales",
  },
};

// ==========================================================
// METERING & LIMITS HELPERS
// ==========================================================

export function getPlanConfig(planId: string | null | undefined): PlanConfig {
  return PLANS[(planId as PlanId) ?? "free"] ?? PLANS.free;
}

// Legacy helper used by settings/layout — maps plan → flat numbers.
export function limitsFor(planId: string | null | undefined): {
  productSlots: number;
  launchesPerProductPerMonth: number;
  visibilityQueriesPerProduct: number;
  videosPerMonth: number;
} {
  const plan = getPlanConfig(planId);
  // Map new plan limits to the legacy shape expected by existing pages.
  const videosPerMonth = plan.limits.videosPerMonth;
  // Derive sensible legacy values from video plan tiers.
  const productSlots = plan.id === "free" ? 1 : plan.id === "starter" ? 3 : plan.id === "pro" ? 10 : 50;
  const launchesPerProductPerMonth = plan.id === "free" ? 2 : plan.id === "starter" ? 5 : plan.id === "pro" ? 20 : 100;
  const visibilityQueriesPerProduct = plan.id === "free" ? 5 : plan.id === "starter" ? 20 : plan.id === "pro" ? 100 : 500;
  return { productSlots, launchesPerProductPerMonth, visibilityQueriesPerProduct, videosPerMonth };
}

export function getPlanPrice(planId: string | null | undefined, billingCycle: "monthly" | "annual"): number {
  return getPlanConfig(planId).price[billingCycle] ?? 0;
}

export function canGenerateVideo(params: {
  planId: string | null | undefined;
  videosUsedThisMonth: number;
  currentResolution: "720p" | "1080p";
  wantsCustomPrompt: boolean;
  wantsBulk: boolean;
  bulkCount: number;
}): { allowed: boolean; reason?: string; overageCost?: number } {
  const plan = getPlanConfig(params.planId);
  const { limits } = plan;

  // Check video count
  if (params.videosUsedThisMonth >= limits.videosPerMonth) {
    // Offer overage at $3/video (matches deductCredit in services/credits.ts)
    const overageCount = params.bulkCount || 1;
    return {
      allowed: true,
      reason: "overage",
      overageCost: overageCount * 300, // $3.00 per overage video in cents
    };
  }

  // Check resolution
  if (params.currentResolution === "1080p" && limits.maxResolution === "720p") {
    return { allowed: false, reason: "Upgrade to Starter for 1080p" };
  }

  // Check custom prompts
  if (params.wantsCustomPrompt && !limits.customPrompts) {
    return { allowed: false, reason: "Upgrade to Pro for custom prompts" };
  }

  // Check bulk generation
  if (params.wantsBulk && !limits.bulkGeneration) {
    return { allowed: false, reason: "Upgrade to Pro for bulk generation" };
  }

  // Check bulk count against plan limit
  const maxBulk = plan.id === "agency" ? 20 : plan.id === "pro" ? 5 : 1;
  if (params.bulkCount > maxBulk) {
    return {
      allowed: false,
      reason: `Max ${maxBulk} videos per bulk generation on ${plan.name}`,
    };
  }

  return { allowed: true };
}

// ==========================================================
// PROFITABILITY ANALYSIS (Admin-only)
// ==========================================================

export function analyzePlanProfitability(planId: PlanId): {
  revenuePerMonth: number;
  maxCostPerMonth: number;
  minProfitPerMonth: number;
  marginPercent: number;
  breakEvenVideos: number;
} {
  const plan = getPlanConfig(planId);
  const revenue = plan.price.monthly / 100; // Convert cents to dollars
  const maxCost = plan.limits.videosPerMonth * COST_PER_VIDEO.total;
  const minProfit = revenue - maxCost;
  const margin = revenue > 0 ? (minProfit / revenue) * 100 : 0;
  const breakEven = revenue > 0 ? Math.floor(revenue / COST_PER_VIDEO.total) : 0;

  return {
    revenuePerMonth: revenue,
    maxCostPerMonth: maxCost,
    minProfitPerMonth: minProfit,
    marginPercent: margin,
    breakEvenVideos: breakEven,
  };
}
