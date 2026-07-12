import type { PlanId } from '@usersessions/shared'

/**
 * Plan limits — BUILD_SPEC §11. Subscription-only; there is no one-time SKU.
 * Simulated runs never count against metering (they exist so adapters can be tested safely).
 */
export interface PlanLimits {
  productSlots: number
  /** Full-network launches per product per calendar month. */
  launchesPerProductPerMonth: number
  /** Free plan only: lifetime cap on real (non-simulated) submissions. */
  lifetimeSubmissionCap: number | null
  /** AI Visibility queries tracked per product. */
  visibilityQueriesPerProduct: number
  /** Reverse trial: days from signup during which live runs are allowed (null = always). */
  trialDays: number | null
  /** Reverse trial: lifetime cap on LIVE launches (distinct live campaigns; null = unlimited). */
  lifetimeLaunchCap: number | null
  /** Review campaigns per calendar month (0 disables the feature; null = unlimited). */
  reviewCampaignsPerMonth: number | null
  /** Max review requests per campaign. */
  reviewRequestsPerCampaign: number
  /** Comparison-content generations per calendar month (0 disables; null = unlimited). */
  contentPerMonth: number | null
  /** Founder-audit cadence in days (0 disables; e.g. 30 = monthly, 7 = weekly). */
  founderAuditIntervalDays: number
  /** Community responses per calendar month (0 disables; null = unlimited). */
  communityResponsesPerMonth: number | null
}

export const PLAN_LIMITS: Record<PlanId, PlanLimits> = {
  free: { productSlots: 1, launchesPerProductPerMonth: 1, lifetimeSubmissionCap: null, visibilityQueriesPerProduct: 1, trialDays: 30, lifetimeLaunchCap: 1, reviewCampaignsPerMonth: 0, reviewRequestsPerCampaign: 0, contentPerMonth: 0, founderAuditIntervalDays: 0, communityResponsesPerMonth: 0 },
  founder: { productSlots: 3, launchesPerProductPerMonth: 2, lifetimeSubmissionCap: null, visibilityQueriesPerProduct: 5, trialDays: null, lifetimeLaunchCap: null, reviewCampaignsPerMonth: 1, reviewRequestsPerCampaign: 50, contentPerMonth: 2, founderAuditIntervalDays: 30, communityResponsesPerMonth: 5 },
  pro: { productSlots: 10, launchesPerProductPerMonth: 10, lifetimeSubmissionCap: null, visibilityQueriesPerProduct: 15, trialDays: null, lifetimeLaunchCap: null, reviewCampaignsPerMonth: 3, reviewRequestsPerCampaign: 200, contentPerMonth: 10, founderAuditIntervalDays: 7, communityResponsesPerMonth: 20 },
  agency: { productSlots: 15, launchesPerProductPerMonth: 10, lifetimeSubmissionCap: null, visibilityQueriesPerProduct: 10, trialDays: null, lifetimeLaunchCap: null, reviewCampaignsPerMonth: null, reviewRequestsPerCampaign: 1000, contentPerMonth: null, founderAuditIntervalDays: 7, communityResponsesPerMonth: null },
}

export function limitsFor(plan: string | null | undefined): PlanLimits {
  return PLAN_LIMITS[(plan as PlanId) ?? 'free'] ?? PLAN_LIMITS.free
}

export function monthStartIso(now = new Date()): string {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString()
}

/** Numeric rank for surface tier-gating (0=free … 3=agency). */
export function planRank(plan: string | null | undefined): number {
  return { free: 0, founder: 1, pro: 2, agency: 3 }[(plan as PlanId) ?? 'free'] ?? 0
}
