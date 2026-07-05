/**
 * Cross-app contracts — THE ONLY home for these types (BUILD_SPEC §14).
 * A type defined in either app that mirrors a concept here is a bug.
 */

export type PlanId = 'free' | 'founder' | 'agency'

export type SubscriptionStatus =
  | 'none'
  | 'active'
  | 'non_renewing'
  | 'attention'
  | 'cancelled'

export type CampaignStatus = 'running' | 'completed' | 'failed'

export type SubmissionStatus =
  | 'submitted'
  | 'awaiting_email_verification'
  | 'live'
  | 'indexed'
  | 'failed'
  | 'removed'

export type PlatformCategory = 'ai' | 'startup' | 'saas' | 'dev'

/** Emitted by every extension adapter, one per platform per campaign. */
export interface PlatformResult {
  platformId: string
  status: SubmissionStatus
  listingUrl?: string
  screenshotUrl?: string
  simulated: boolean
  error?: string
}

/** Body of POST /api/campaigns (extension → dashboard). */
export interface CampaignPayload {
  campaignId: string
  productId: string
  startedAt: string
  finishedAt?: string
  results: PlatformResult[]
}

export type CampaignApiError =
  | 'PLAN_LIMIT_EXCEEDED'
  | 'UNAUTHORIZED'
  | 'INVALID_PAYLOAD'

export interface CampaignResponse {
  ok: boolean
  campaignId?: string
  error?: CampaignApiError
}

/** One AI-copy edit record. */
export interface EditsTelemetry {
  platformCategory: PlatformCategory
  originalHook?: string
  editedHook?: string
  originalBody?: string
  editedBody?: string
  wasEdited: boolean
}

/** Body of POST /api/telemetry/ai-edits. Fire-and-forget; server always returns 200. */
export interface TelemetryBatch {
  entries: EditsTelemetry[]
}

/** POST /api/campaigns/preflight — zero warnings is a valid, correct response. */
export interface PreflightWarning {
  platformId: string
  reason: string
  suggestedAngle: string
}
export interface PreflightResponse {
  warnings: PreflightWarning[]
}

/** Site data extracted by the content script from the founder's landing page. */
export interface SiteData {
  url: string
  title: string
  description: string
  tagline?: string
  keywords: string[]
  h1s: string[]
}

/** AI-generated, user-editable copy for one platform category (BUILD_SPEC §7: creative director, not bystander). */
export interface GeneratedCopy {
  category: PlatformCategory
  hook: string
  body: string
}

/** Response of POST /api/ai/copy (extension → dashboard, Bearer-authenticated; Gemini key stays server-side). */
export interface CopyResponse {
  copy: GeneratedCopy[]
}

/** Dashboard → extension bridge message (chrome.runtime.sendMessage, externally_connectable). */
export type BridgeMessage = { type: 'SET_TOKEN'; token: string }

/** UTM appended by adapters to every listing URL BEFORE submission (BUILD_SPEC §7). */
export function utmQuery(campaignId: string): string {
  return `utm_source=usersessions&utm_medium=distribution&utm_campaign=${encodeURIComponent(campaignId)}`
}

export function appendUtm(url: string, campaignId: string): string {
  const sep = url.includes('?') ? '&' : '?'
  return `${url}${sep}${utmQuery(campaignId)}`
}
