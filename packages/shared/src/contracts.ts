/**
 * Cross-app contracts — THE ONLY home for these types (BUILD_SPEC §14).
 * A type defined in either app that mirrors a concept here is a bug.
 */

export type PlanId = 'free' | 'founder' | 'pro' | 'agency'

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

/** Per-platform submission requirements, declared on each extension adapter (context-aware automation). */
export interface PlatformRequirements {
  /** Platform mandates a product screenshot/gallery image. */
  requiresScreenshot?: boolean
  /** Submission form is only reachable via OAuth/social login. */
  requiresSocialAuth?: boolean
  /** An account must exist before the form is reachable — the extension hands signup to the human, never creates it. */
  requiresAccount?: boolean
  /** Platform confirms listings by email — successful live submits become awaiting_email_verification. */
  requiresEmailVerification?: boolean
}

/** Emitted by every extension adapter, one per platform per campaign. */
export interface PlatformResult {
  platformId: string
  status: SubmissionStatus
  listingUrl?: string
  screenshotUrl?: string
  simulated: boolean
  /** For surface (non-directory) submissions: the dedicated surface status. */
  surfaceStatus?: 'in_progress' | 'submitted' | 'verified' | 'rejected'
  error?: string
}

/** Body of POST /api/campaigns (extension → dashboard). */
export interface CampaignPayload {
  campaignId: string
  productId: string
  /** Product bootstrap: if productId is unknown to the server, it creates the product from these. */
  productName?: string
  productUrl?: string
  startedAt: string
  finishedAt?: string
  results: PlatformResult[]
}

export type CampaignApiError =
  | 'PLAN_LIMIT_EXCEEDED'
  | 'UNAUTHORIZED'
  | 'INVALID_PAYLOAD'
  | 'RATE_LIMITED'

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
export type BridgeMessage =
  | { type: 'SET_TOKEN'; token: string }
  /** Dashboard asks the extension to start a directory campaign (optionally simulated). */
  | { type: 'TRIGGER_LAUNCH'; simulated?: boolean }
  /** Dashboard asks the extension to open a specific surface for assisted distribution. */
  | { type: 'TRIGGER_SURFACE'; surfaceId: string }
  /** Dashboard asks the extension to open a tracked_only surface's on-page verify flow. */
  | { type: 'TRIGGER_SURFACE_VERIFY'; surfaceId: string; surfaceName: string; url: string }
  /** Dashboard asks the extension to capture the user's active tab (best-effort). */
  | { type: 'TRIGGER_CAPTURE' }

/** UTM appended by adapters to every listing URL BEFORE submission (BUILD_SPEC §7). */
export function utmQuery(campaignId: string): string {
  return `utm_source=usersessions&utm_medium=distribution&utm_campaign=${encodeURIComponent(campaignId)}`
}

export function appendUtm(url: string, campaignId: string): string {
  const sep = url.includes('?') ? '&' : '?'
  return `${url}${sep}${utmQuery(campaignId)}`
}

/**
 * AIO (AI Optimization) audit — how well AI assistants can understand and recommend
 * a founder's landing page. THE ONLY home for these types (Feature A).
 */
export type AuditCategoryName =
  | 'h1_clarity'
  | 'faq_presence'
  | 'comparison_content'
  | 'structured_data'
  | 'social_proof'
  | 'pricing_clarity'
  | 'meta_description'

export interface AuditCategory {
  name: AuditCategoryName
  /** Human-readable label for the UI. */
  label: string
  score: number
  max: number
  /** What we observed. */
  feedback: string
  /** Actionable, specific fix. */
  suggestion: string
}

export interface LandingPageAuditResult {
  productId: string
  url: string
  overallScore: number // 0-100
  categories: AuditCategory[]
  /** The single highest-impact fix, surfaced prominently. */
  topPriority: string
  auditedAt: string // ISO
}

export type AuditApiError = 'UNAUTHORIZED' | 'INVALID_PAYLOAD' | 'FETCH_FAILED' | 'RATE_LIMITED' | 'PLAN_LIMIT_EXCEEDED'

export interface AuditResponse {
  ok: boolean
  audit?: LandingPageAuditResult
  error?: AuditApiError
}

/**
 * Category Query Ownership (Feature B) — upgrades AI Visibility from "was I mentioned?"
 * to "do I own this category?". THE ONLY home for these types.
 */
export type VisibilityQueryType = 'category_direct' | 'alternative' | 'comparison' | 'use_case'

/** Relative weight of each query type in the Category Ownership Score. */
export const QUERY_TYPE_WEIGHT: Record<VisibilityQueryType, number> = {
  category_direct: 1.0,
  use_case: 0.9,
  comparison: 0.7,
  alternative: 0.7,
}

export interface VisibilityQuerySummary {
  id: string
  query: string
  queryType: VisibilityQueryType
  categoryTag: string | null
  mentioned: boolean | null // null = not yet checked
  rank: number | null
  snippet: string | null
  engine: string | null
  checkedAt: string | null
}

/** Share-of-voice for one entity (the product or a competitor) across tracked queries. */
export interface ShareOfVoiceEntry {
  name: string
  /** Whether this row is the user's own product. */
  isSelf: boolean
  mentions: number
  totalQueries: number
  /** 0-100. */
  sharePct: number
}

export interface CategoryOwnership {
  /** 0-100, weighted by query-type importance and mention frequency. */
  ownershipScore: number
  queries: VisibilityQuerySummary[]
  shareOfVoice: ShareOfVoiceEntry[]
  /** Queries where competitors appear but the product does not. */
  gaps: string[]
}

/** One AI-suggested category query, pending user review before it is saved. */
export interface SuggestedQuery {
  query: string
  queryType: VisibilityQueryType
  categoryTag: string | null
}

export interface SuggestQueriesResponse {
  ok: boolean
  suggestions?: SuggestedQuery[]
  error?: 'UNAUTHORIZED' | 'INVALID_PAYLOAD' | 'AI_NOT_CONFIGURED' | 'GENERATION_FAILED' | 'RATE_LIMITED'
}

/**
 * AI-training surfaces beyond directories (Feature C). This is ASSISTED distribution with
 * tracking — never automated account actions. Reddit is intentionally excluded: its
 * automation/self-promotion detection bans real user accounts, which would harm the user.
 */
export type SurfaceCategory = 'github' | 'blog' | 'twitter' | 'podcast' | 'youtube' | 'stackoverflow' | 'community' | 'marketplace'

export type SurfaceSubmissionType = 'automated' | 'assisted_manual' | 'tracked_only'

export interface Surface {
  id: string
  name: string
  category: SurfaceCategory
  urlPattern: string
  submissionType: SurfaceSubmissionType
  qualityScore: number
  /** 0=free, 1=founder, 2=pro, 3=agency. */
  tierUnlock: number
}

export type SurfaceStatus = 'not_started' | 'in_progress' | 'submitted' | 'verified' | 'rejected'

/**
 * Maps a submission row (shared with directories) to a surface-specific status.
 * `surface_status` is authoritative when present; otherwise derived from the generic
 * submission status so old rows still render sensibly.
 */
export function surfaceStatusFrom(
  surfaceStatus: string | null | undefined,
  submissionStatus: string | null | undefined
): SurfaceStatus {
  const s = (surfaceStatus ?? '').toLowerCase()
  if (s === 'in_progress' || s === 'submitted' || s === 'verified' || s === 'rejected') return s
  switch ((submissionStatus ?? '').toLowerCase()) {
    case 'live':
    case 'indexed':
      return 'verified'
    case 'failed':
    case 'removed':
      return 'rejected'
    case 'submitted':
    case 'awaiting_email_verification':
      return 'submitted'
    default:
      return 'not_started'
  }
}

/**
 * Review Generation System (Feature 1). We REQUEST honest reviews from a founder's own
 * activated users — never fake, gate, or incentivize them. THE ONLY home for these types.
 */
export type ReviewRequestStatus = 'draft' | 'sent' | 'opened' | 'clicked' | 'reviewed'

export interface ReviewPlatform {
  id: string
  name: string
  url: string
  category: string
  qualityScore: number
  tierUnlock: number
}

export interface ReviewRecipientInput {
  email: string
  name?: string
  activationEvent?: string
}

export interface ReviewRequestView {
  id: string
  recipientEmail: string
  recipientName: string | null
  status: ReviewRequestStatus
  platformId: string | null
  sentAt: string | null
}

export interface ReviewCampaignFunnel {
  id: string
  status: string
  createdAt: string
  total: number
  sent: number
  opened: number
  clicked: number
  reviewed: number
}

export type ReviewApiError =
  | 'UNAUTHORIZED'
  | 'INVALID_PAYLOAD'
  | 'PLAN_LIMIT_EXCEEDED'
  | 'RATE_LIMITED'
  | 'AI_NOT_CONFIGURED'
  | 'GENERATION_FAILED'

export interface ReviewCampaignResponse {
  ok: boolean
  campaignId?: string
  /** Draft, editable request emails — one per recipient, for founder review before send. */
  drafts?: Array<{ requestId: string; recipientEmail: string; recipientName: string | null; subject: string; body: string }>
  error?: ReviewApiError
}

/**
 * Comparison Content Generator (Feature 2). Server-side Gemini drafts editable content the
 * founder publishes on their own site. THE ONLY home for these types.
 */
export type ContentType = 'vs_page' | 'best_tools_roundup' | 'alternative_post' | 'faq_page'

export interface GeneratedContentView {
  id: string
  contentType: ContentType
  draftMarkdown: string
  publishedUrl: string | null
  aiCitationCount: number
  createdAt: string
}

export type ContentApiError =
  | 'UNAUTHORIZED'
  | 'INVALID_PAYLOAD'
  | 'PLAN_LIMIT_EXCEEDED'
  | 'RATE_LIMITED'
  | 'AI_NOT_CONFIGURED'
  | 'GENERATION_FAILED'

export interface ContentGenerateResponse {
  ok: boolean
  /** Editable markdown draft. */
  markdown?: string
  /** Suggested schema.org JSON-LD block for the page. */
  schemaSuggestion?: string
  error?: ContentApiError
}

/**
 * Founder Brand Audit (Feature 3). Scores a founder's personal profiles for how clearly they
 * signal “builder of <product>, a <category> tool” to humans and AI. THE ONLY home for these.
 */
export type FounderPlatform = 'linkedin' | 'twitter' | 'github' | 'indiehackers'

export interface FounderPlatformScore {
  platform: FounderPlatform
  label: string
  score: number
  max: number
  feedback: string
  suggestion: string
  /** Ready-to-paste optimized copy for this platform (bio/headline/pinned post). */
  suggestedCopy: string
}

export interface FounderAuditResult {
  productId: string
  overallScore: number // 0-100
  platforms: FounderPlatformScore[]
  topPriority: string
  auditedAt: string
}

export type FounderAuditError =
  | 'UNAUTHORIZED'
  | 'INVALID_PAYLOAD'
  | 'PLAN_LIMIT_EXCEEDED'
  | 'RATE_LIMITED'
  | 'AI_NOT_CONFIGURED'
  | 'GENERATION_FAILED'

export interface FounderAuditResponse {
  ok: boolean
  audit?: FounderAuditResult
  error?: FounderAuditError
}

/**
 * Community Participation Engine (Feature 5). ASSISTED + human-posted only: we surface relevant
 * discussions and draft honest, non-promotional responses the founder edits and posts themselves.
 * Reddit is intentionally excluded (its self-promotion detection bans real user accounts).
 * THE ONLY home for these types.
 */
export type CommunitySurface = 'indiehackers' | 'stackoverflow' | 'linkedin' | 'hackernews' | 'other'

export type CommunityOpportunityStatus = 'new' | 'approved' | 'responded' | 'ignored'

export interface CommunityOpportunity {
  id: string
  surface: CommunitySurface
  url: string
  title: string
  contentSnippet: string | null
  relevanceScore: number
  status: CommunityOpportunityStatus
  createdAt: string
}

export interface CommunityResponseView {
  id: string
  opportunityId: string
  draftResponse: string
  finalResponse: string | null
  postedAt: string | null
}

export type CommunityApiError =
  | 'UNAUTHORIZED'
  | 'INVALID_PAYLOAD'
  | 'PLAN_LIMIT_EXCEEDED'
  | 'RATE_LIMITED'
  | 'AI_NOT_CONFIGURED'
  | 'GENERATION_FAILED'

export interface CommunityRespondResponse {
  ok: boolean
  responseId?: string
  draftResponse?: string
  error?: CommunityApiError
}

/**
 * Referral Program Generator (Feature 6). AI proposes a referral structure + copy the founder
 * implements in their OWN product. THE ONLY home for these types.
 */
export type ReferralStructure = 'give_get' | 'credits' | 'discount' | 'cash' | 'tiered'

export interface ReferralProgramCopy {
  landingHeadline: string
  landingBody: string
  landingCta: string
  inAppTooltip: string
  inviteEmailSubject: string
  inviteEmailBody: string
  socialPost: string
}

export interface ReferralProgramView {
  id: string
  structureType: ReferralStructure
  copy: ReferralProgramCopy
  implementedUrl: string | null
  createdAt: string
}

export type ReferralApiError =
  | 'UNAUTHORIZED'
  | 'INVALID_PAYLOAD'
  | 'PLAN_LIMIT_EXCEEDED'
  | 'RATE_LIMITED'
  | 'AI_NOT_CONFIGURED'
  | 'GENERATION_FAILED'

export interface ReferralGenerateResponse {
  ok: boolean
  structureType?: ReferralStructure
  copy?: ReferralProgramCopy
  error?: ReferralApiError
}

/** Body of POST /api/surfaces/copy — surface-specific assisted copy. */
export interface SurfaceCopyResponse {
  ok: boolean
  /** Ready-to-paste text for the surface (Reddit-free; GitHub PR / blog outline / tweet / etc.). */
  copy?: string
  error?: 'UNAUTHORIZED' | 'INVALID_PAYLOAD' | 'AI_NOT_CONFIGURED' | 'GENERATION_FAILED' | 'RATE_LIMITED' | 'TIER_LOCKED'
}

// ---------------------------------------------------------------------------
// Feature Usage Tracking (migration 0034_feature_events)
// ---------------------------------------------------------------------------

/** Every trackable feature. Must stay in lockstep with the feature_events check constraint. */
export type FeatureName =
  | 'aio_audit' | 'ai_visibility_query' | 'ai_visibility_suggest' | 'category_ownership_view'
  | 'surface_distribution' | 'surface_verify' | 'intelligence_briefing_view' | 'intelligence_briefing_email'
  | 'competitor_scan' | 'competitor_scan_run' | 'review_campaign_create' | 'review_request_send'
  | 'comparison_content_generate' | 'founder_audit' | 'referral_program_generate' | 'community_response_draft'
  | 'campaign_launch' | 'campaign_simulate' | 'report_view' | 'platform_browse' | 'surface_browse'
  | 'analytics_view' | 'settings_view' | 'pricing_view' | 'cancel_flow_start'

/** Interaction class for a feature event. Must match the event_type check constraint. */
export type FeatureEventType = 'view' | 'click' | 'generate' | 'submit' | 'export' | 'email'

export interface FeatureEventInput {
  feature: FeatureName
  type: FeatureEventType
  productId?: string | null
  metadata?: Record<string, unknown>
}

/** POST /api/events — always returns 204; body is intentionally empty (fire-and-forget). */
export type FeatureEventResponse = void

// ---------------------------------------------------------------------------
// Platform Request / Voting (migration 0035_platform_requests)
// ---------------------------------------------------------------------------

export type PlatformRequestCategory = 'ai' | 'startup' | 'saas' | 'dev' | 'marketplace' | 'other'
export type PlatformRequestStatus = 'pending' | 'under_review' | 'approved' | 'rejected' | 'shipped'

export interface PlatformRequest {
  id: string
  name: string
  url: string | null
  category: PlatformRequestCategory
  description: string | null
  requesterId: string | null
  status: PlatformRequestStatus
  voteCount: number
  createdAt: string
  updatedAt: string
  /** True when the current authenticated caller has an active vote. */
  hasVoted: boolean
}

export interface CreatePlatformRequestInput {
  name: string
  url?: string
  category: PlatformRequestCategory
  description?: string
}

export interface PlatformRequestResponse {
  ok: boolean
  request?: PlatformRequest
  error?: 'UNAUTHORIZED' | 'INVALID_PAYLOAD' | 'DUPLICATE_NAME' | 'NOT_FOUND' | 'RATE_LIMITED'
}

export interface PlatformRequestListResponse {
  ok: boolean
  requests: PlatformRequest[]
}

export interface PlatformVoteResponse {
  ok: boolean
  voteCount?: number
  hasVoted?: boolean
  error?: 'UNAUTHORIZED' | 'NOT_FOUND' | 'RATE_LIMITED'
}
