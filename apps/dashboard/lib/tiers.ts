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
}

export const PLAN_LIMITS: Record<PlanId, PlanLimits> = {
  free: { productSlots: 1, launchesPerProductPerMonth: 1, lifetimeSubmissionCap: null, visibilityQueriesPerProduct: 1, trialDays: 30, lifetimeLaunchCap: 1 },
  founder: { productSlots: 3, launchesPerProductPerMonth: 2, lifetimeSubmissionCap: null, visibilityQueriesPerProduct: 5, trialDays: null, lifetimeLaunchCap: null },
  pro: { productSlots: 10, launchesPerProductPerMonth: 10, lifetimeSubmissionCap: null, visibilityQueriesPerProduct: 15, trialDays: null, lifetimeLaunchCap: null },
  agency: { productSlots: 15, launchesPerProductPerMonth: 10, lifetimeSubmissionCap: null, visibilityQueriesPerProduct: 10, trialDays: null, lifetimeLaunchCap: null },
}

export function limitsFor(plan: string | null | undefined): PlanLimits {
  return PLAN_LIMITS[(plan as PlanId) ?? 'free'] ?? PLAN_LIMITS.free
}

export function monthStartIso(now = new Date()): string {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString()
}
