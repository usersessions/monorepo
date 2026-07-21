# usersessions.io — Complete Feature Map (Beginning → End)

> **What it is:** usersessions.io gets your product listed everywhere AI assistants and humans discover software, then monitors whether they actually recommend you.
>
> **Core loop:** Submit → Verify → Measure

---

## 🏗️ Phase 0 — Foundation & Infrastructure

### Database Schema (36 migrations)
| Migration | What it built |
|-----------|---------------|
| `0001_core` | Core tables: `profiles`, `products`, `platforms`, `campaigns`, `submissions`, `distribution_scores`, `edits_telemetry`, `feature_flags` |
| `0002_monitoring` | `resubmission_queue`, `cron_logs`, `notifications` |
| `0003_measurement` | `visibility_queries`, `visibility_checks` (append-only, verbatim AI snippets) |
| `0004_admin` | `adapter_runs`, `admin_audit_log` (append-only, never edited from UI) |
| `0005_link_check` | Link check infrastructure |
| `0006_activate_features` | Feature flag seeding |
| `0007_admin_user` | Admin user bootstrap |
| `0008_activate_platform_catalog` | Platform catalog seed (15 AI directories) |
| `0009_realtime` | Supabase realtime publications |
| `0010_notification_prefs` | Notification preferences |
| `0011_competitor_scans` | `competitor_scans` table |
| `0012_integrations` | Integration tracking |
| `0013_performance_indexes` | DB performance indexes |
| `0014_admin_expansion` | Extended admin tables |
| `0015_activate_billing` | Billing tables + Paystack fields on `profiles` |
| `0017_catalog_reality` | Platform catalog corrections |
| `0018_competitor_automation` | Automated competitor scan infra |
| `0019_sandbox_activation` | Simulation mode activation |
| `0020_adapter_verifications` | `adapter_verifications` table (user-verified adapters) |
| `0020_platform_health` | Platform health tracking |
| `0021_agent_computer_use` | Agent computer-use sessions |
| `0022_email_events` | `email_events` table (Resend webhook log) |

### Auth & Identity
- **Supabase magic link + Google OAuth** — single flow
- `/auth/callback` ensures a `profiles` row on first sign-in
- Welcome email + admin new-signup alert fires once on first profile creation
- Middleware route protection (every `/dashboard/*` route)

### Design System
- Color token system: `--cyan` (happening-now), `--green/--amber/--red` (fixed state), `--primary` (CTA)
- Typography: DM Mono for data, serif for metrics
- Shared CSS tokens in `packages/shared/src/tokens.css`
- Status classes identical across popup, dashboard, and admin

---

## 🧩 Phase 1 — Chrome Extension (Plasmo MV3)

### Core Extension Engine
- **Background service worker** (`background.ts`, 34KB) — MV3-safe campaign loop surviving worker restarts via `chrome.alarms`
- **Capture engine:** 16:9 hero crop (`cropDataUrl`, OffscreenCanvas), scrolled gallery shot, 1:1 logo (`captureLogo` — apple-touch-icon → og:image → favicon)
- **Content script** (`contents/extract`) — reads title, description, keywords, headings into `SiteData`
- **`ExtensionBridge`** — dashboard hands Supabase access token to extension via postMessage + `chrome.runtime.sendMessage`, race-proof retry/ack handshake. Token refreshes re-delivered automatically

### Campaign Loop (the core submission engine)
1. `START_CAMPAIGN` builds `CampaignRunState` in `chrome.storage.local`
2. Platforms run one at a time with human-mimicking pacing (45-75s live, 2s sim)
3. Per platform: tab opens → capture engine grabs media → generic adapter-runner executes declarative steps (`fill/smartFill/select/check/upload/next/waitFor/submit`)
4. CAPTCHA/OTP/login → pause (`awaiting_user_action`) with badge + system notification → human acts → resume
5. Simulation always stops before submit (fail-closed: live only if registry-verified)
6. Queue drained → `POST /api/campaigns` heartbeat sync

### Adapter System
- **`adapters/registry.ts`** — 15 platform adapters (AI directories + launch platforms)
- **`adapters/types.ts`** — `RunContext`, `AdapterOutcome`, `FounderProfile`
- **Generic runner:** `fill`, `smartFill` (fuzzy checkbox matching), `select`, `check`, `upload`, `next`, `waitFor`, `submit`
- **`adapter_verifications`** table — user-verified adapters unlock live mode per-platform

### Extension Popup
- Focused launcher: wordmark + connection status, Analyze, "Launch directories", "Distribute to surfaces"
- `AgentPanel.tsx`, `SurfacesPanel.tsx` for different flow views

### AI Copy Generation
- `POST /api/ai/copy` (Bearer-authed, Gemini key server-side) — per-category listing copy
- **Approval UI:** founder edits and approves EVERY word before anything runs
- Founder profile auto-fills from `GET /api/profile`, editable

---

## 📊 Phase 2 — Dashboard (Next.js App Router)

### Overview Page (`/`)
- Realtime refresh (Supabase publications, zero polling) via `RealtimeRefresh.tsx`
- `NotificationToaster` — instant in-app toast when extension syncs
- **Distribution Score** + **AI Visibility Score** — serif metric cards
- 90-day TrendChart (shared SVG component; <2 points → honest flat placeholder)
- Install → Launch → Watch progress indicator
- Product switcher (multi-product portfolio support)

### Campaigns (`/campaigns`)
- Inline row expansion, per-platform results, report links
- `ExtensionActionButton` — triggers `TRIGGER_LAUNCH` on the extension from dashboard

### Listings (`/listings`)
- All submissions with filters
- Platform Quality badges (never "backlinks")
- Resubmit on dead rows
- "Confirm via email" prompts on `awaiting_email_verification` rows
- `PlatformVerifyButton` component

### Platforms (`/platforms`)
- Quality-sorted grid, editorial estimates labeled until computed
- Locked tiers visible at reduced opacity (never hidden)
- **`PlatformRequestBoard`** — top-5 community requests with realtime vote counts, request modal, one-click upvote/un-vote

### Analytics (`/analytics`)
- Score trends, link-survival curve (7/30/60/90-day cohorts)
- Per-user platform ranking
- **Category Ownership** card (score + share-of-voice bars vs top 3 competitors + gap indicator)
- Visibility query management with type selector
- **"Suggest queries with AI"** — Gemini proposes 5 queries; each editable + must be approved before saving

### Reports (`/reports/[campaignId]`)
- Public shareable report, 404 if invalid
- Print-optimized (print-to-PDF IS the PDF)
- Agency branding plumbing

### Onboarding (`/onboarding`)
- Guided flow for new users
- Shared `onboardingLabel` / `OnboardingProgress` logic in `lib/onboarding.ts`

### Notifications (`/notifications`)
- Real-time notification feed

### Settings (`/settings`)
- Connection badge (`ExtensionStatus` = ping-only)
- Billing management + cancel flow

### Settings / Cancel (`/settings/cancel`)
- One reason question → one mapped save offer (downgrade / 60-day pause / support)
- One-click cancel always visible
- CA ARL compliant

---

## 💰 Phase 3 — Billing (Paystack)

### Plans
| Plan | Price | Products | Launches | Monitoring | AI Visibility |
|------|-------|----------|----------|------------|---------------|
| Free | $0 | 1 | 1 live launch (reverse trial: 30 days full access) | View-only | 1 query/month |
| Founder | $39/mo | 3 | 2 full launches/product/mo | Full | 5/product/week |
| Pro | $99/mo | 10 | 10 launches/product/mo | Full | 15/product/week |
| Agency/Enterprise | Custom $299+ | 15 client workspaces | Pooled | Full | 10/product/week |

### Checkout & Webhooks
- `POST /api/billing/checkout` → plan lookup (amount from Paystack) → authorization URL
- HMAC-SHA512 webhook verification
- Events: `charge.success`, `subscription.create`, `subscription.disable`, `invoice.payment_failed`
- Auto-disables previous subscription on plan switch (no double-billing)
- Self-healing cancel: recovers `subscription_code` + `email_token` live from Paystack if missing

### Metering
- `/api/campaigns` — slots, launches/month, platform tiers → `PLAN_LIMIT_EXCEEDED`
- **Reverse trial:** free users get 30 days full access from signup + 1 lifetime live launch
- `lib/tiers.ts` — single source of truth for all plan limits

---

## 🔍 Phase 4 — Monitoring Engine (The Recurring Value)

### Link-Check Cron (03:00 UTC daily)
- GET fallback with retry + backoff
- **48h grace before `removed`** (false dead-link alerts are trust-fatal)
- Promotion to `indexed` status
- Triggers: notification + score recompute + lifecycle emails
- Auto-resubmission for Founder/Pro/Agency plans

### AI Visibility Cron (Tuesdays 06:00 UTC)
- 3-5 user-editable queries per product
- Weekly checks across Gemini (single-engine, cost decision)
- Verbatim snippets stored and shown as-is
- "Not mentioned" weeks displayed, never smoothed
- Score 0-100, append-only
- Stores full recommendation list → `visibility_competitors` for share-of-voice

### Platform Quality Cron (03:30 UTC daily)
- Nightly aggregation across ALL users (survival + indexation + editorial)
- Stored on `platforms.quality_score`

### Competitor Scan Cron (05:00 UTC daily)
- Plan-gated: Founder 7d / Agency 1d / Free skipped
- Scans competitor distribution across tracked platforms

### Intelligence Briefing Cron (Mondays 09:00 UTC)
- Paying users only (Founder/Pro/Agency)
- 4 real-data sections: new competitor appearances, new catalog platforms, category query flips
- Sections with no signal omitted (never padded)
- Users with zero news get no email

### Weekly Digest Cron (Mondays 08:00 UTC)
- Metric cards + CTA via Resend

---

## 📧 Phase 5 — Email System (Resend)

### Design System (`lib/email/template.ts`)
- Dark-first 600px layout (ink/ink2 tokens)
- Components: `dataTable`, `statusBadge`, `metricCard`, `ctaButton`, `escapeHtml`
- Auto-derived plain-text fallback for every email (spam scoring + a11y)
- CAN-SPAM compliant (postal address footer)

### Transactional Emails
| Email | Trigger |
|-------|---------|
| Welcome | First profile creation (`/auth/callback`) |
| Admin new-signup alert | Same trigger → admin address |
| Campaign complete | `POST /api/campaigns` with `finishedAt` |
| Simulation finished | Same, simulation flag |
| Usage limit warning (80%) | Same, crosses 80% of monthly quota |
| Listing live | Link-check cron: `submitted → live` promotion |
| Listing rejected/dead | Link-check cron: confirmed 48h dead link |
| Payment received | Paystack webhook `charge.success` |
| Payment failed (dunning) | Paystack webhook `invoice.payment_failed` |
| Weekly digest | Monday 08:00 cron |
| Intelligence briefing | Monday 09:00 cron |
| Competitor scan report | Competitor scan cron |

### Resend Event Webhook (`/api/webhooks/resend`)
- svix HMAC-SHA256 signature verification (5-min replay window)
- Logs: sent / delivered / opened / clicked / bounced / complained → `email_events` (migration 0022)
- Advances `review_requests` status on open/click events

---

## 🔮 Phase 6 — Pivot Features (A–D)

### Feature A: AI-Readable Landing Page Audit (`/audit`)
- Endpoint: `POST /api/audit`
- 7 scored categories: H1 clarity (Gemini-refined), FAQ, comparison, JSON-LD, social proof, pricing clarity, meta description
- Overall 0-100 score; lowest-fraction → topPriority callout
- Cadence-gated (1/week free+founder, 1/day pro+agency)
- `ExtensionActionButton` on `/audit` for best-effort page capture
- Migration: `0023_landing_page_audits`

### Feature B: Category Query Ownership
- Upgraded AI Visibility: stores FULL recommendation list → `visibility_competitors` (share-of-voice, upsert per query+competitor+engine)
- Category Ownership Score: weighted by `QUERY_TYPE_WEIGHT` with rank decay (never below 40%)
- Query types: `category_direct`, `use_case`, `problem`, `comparison`, `recommendation`
- Migration: `0024_category_ownership`

### Feature B (Addendum): AI-Assisted Query Suggestions
- `POST /api/visibility/suggest` — Gemini proposes 5 category queries
- `SuggestQueries.tsx` — editable suggestions, must be explicitly Approved
- Persists NOTHING until approved

### Feature C: AI Training Surface Expansion (`/surfaces`)
- Migration: `0025_surfaces` — seeded GitHub Awesome Lists, Dev.to, Hashnode, Indie Hackers, Stack Overflow, X/Twitter (tier-gated; **Reddit intentionally excluded**)
- Dashboard: quality-sorted, category-grouped grid with locked surfaces at reduced opacity
- `POST /api/surfaces/copy` — tier-gated, Gemini drafts surface-specific copy (draft only, never auto-posts)
- Extension "Distribute to Surfaces" flow: floating sidebar (shadow DOM), editable draft, Copy-to-clipboard, Take-screenshot, Mark-as-submitted
- `surface_status` column (in_progress / submitted / verified / rejected): migration `0027`
- Link-check cron extended to cover surface submissions

### Feature D: Competitive Intelligence Briefings
- Migration: `0026_intelligence_briefings`
- Weekly cron for paying users: 4 real-data sections assembled from live DB
- Dashboard `/competitors` upgrade: "Weekly briefing" card with competitor-moved alert badge

---

## 🚀 Phase 7 — Acquisition Features (1–6)

### Feature 1: Review Generation System (`/reviews`)
- Migration: `0028_review_system` — `review_platforms` (G2, Capterra, Trustpilot, Product Hunt, Chrome Web Store), `review_campaigns`, `review_requests`
- `POST /api/reviews/campaign` — AI-drafts personalized honest review request emails (not positive — honest)
- `POST /api/reviews/send` — Resend delivery, fail-soft
- `GET /api/reviews/campaigns` — cumulative sent/opened/clicked/reviewed funnel
- 4-step UI builder: recipients → platform → AI drafts → edit → approve & send
- Funnel advances via Resend event webhook (open/click → status promotion)
- **Ethics guardrail:** no review-gating, no incentives, no fake reviews

### Feature 2: Comparison Content Generator (`/content`)
- Migration: `0029_generated_content`
- `POST /api/ai/content` — Gemini drafts: vs-page / roundup / alternative / FAQ as editable Markdown + schema.org JSON-LD
- Content types: honest, no fabricated benchmarks, fair to competitors
- Metered: `contentPerMonth` (free 0, founder 2, pro 10, agency unlimited)
- Copy Markdown / Download HTML / Save draft / saved-drafts list
- `published_url` field for tracking (citation monitoring deferred)

### Feature 3: Founder Brand Audit (`/founder-audit`)
- Migration: `0030_founder_audits`
- `POST /api/founder-audit` — fetches LinkedIn/X/GitHub/Indie Hackers profiles, Gemini scores each 0-10 with feedback + actionable suggestion + ready-to-paste optimized copy
- Overall 0-100 score; weakest platform → topPriority
- Cadence-gated by plan (`founderAuditIntervalDays`)
- Copy button per-platform for suggested optimized bios

### Feature 4: Marketplace Distribution (`/surfaces` — marketplace category)
- Migration: `0031_marketplace_surfaces` — Chrome Web Store, Slack Marketplace, Shopify App Store, GitHub Marketplace, Zapier Directory, Notion Gallery, Figma Community
- Reuses surfaces engine (no new pipeline)
- Copy API gains `marketplace` format: tagline + description + feature bullets
- Same Distribute-to-Surfaces flow + link-check monitoring loop

### Feature 5: Community Participation Engine (`/communities`)
- Migration: `0032_community` — `community_opportunities` + `community_responses`
- **Reddit intentionally excluded** (account-safety)
- Allowed surfaces: Indie Hackers, Stack Overflow, Hacker News, LinkedIn, Other
- `POST /api/communities/respond` — Gemini drafts help-first reply mentioning product only if relevant
- Manual opportunity curation + add-form
- **Automated scan cron (Mondays 07:00 UTC):** Stack Overflow (StackExchange API) + Hacker News (Algolia API) — real public APIs only
- In-tab reply via extension surface sidebar
- Metered: `communityResponsesPerMonth` (free 0, founder 5, pro 20, agency unlimited)

### Feature 6: Referral Program Generator (`/referrals`)
- Migration: `0033_referral_programs`
- `POST /api/referrals/generate` — Gemini picks structure (give_get / credits / discount / cash / tiered), writes full copy set: landing headline/body/CTA, in-app tooltip, invite email, social post
- Honest guardrails: no fabricated metrics, no hype words
- Metered: `referralProgramsPerMonth` (free 0, founder 1, pro 3, agency unlimited)
- Editable per-field copy with Copy buttons + saved-programs list

---

## 🔧 Phase 8 — Admin Panel (`/admin/*`)

### Admin Security
- Server-side role check + hard redirect on EVERY `/admin/*` route (never CSS-hidden)
- Every mutation writes to `admin_audit_log` (append-only)

### Admin Pages
| Page | What it does |
|------|-------------|
| `/admin` | System overview: cron_logs, queue depths |
| `/admin/users` | Suspend users, time-limited bannered impersonation |
| `/admin/flags` | Feature flag management |
| `/admin/billing` | Billing overrides |
| `/admin/adapter-review` | Canary results, Approve → Stage 10% / Reject |
| `/admin/data-quality` | `edits_telemetry` browser |
| `/admin/usage` | 7-day metric cards, sortable breakdown table, 30-day dead-feature list (auto-flagged: <5% adoption or <3 uses), stacked-area trend chart (top-5 features + "other") |
| `/admin/platform-requests` | Filter by status, expandable rows, approve/reject/mark-shipped actions |

---

## 📡 Phase 9 — Feature Usage Tracking + Platform Requests

### Feature Usage Tracking
- Migration: `0034_feature_events` — append-only, 25-value `feature_name` enum, 6-value `event_type` enum
- `POST /api/events` — always 204, swallows all errors (fire-and-forget)
- `lib/tracking.ts` — `trackFeature()` (client) + `trackFeatureServer()` (server), both fail-soft
- `TrackView.tsx` — drop-in mount tracker for server-component pages
- **25 tracked features:** analytics_view, competitors_view, founder_audit_*, aio_audit_*, content_*, reviews_*, referrals_*, settings_*, surfaces_*, campaigns_*, platforms_view, pricing_view, reports_view, ai_visibility_*, competitor_scan_*, category_ownership_view, intelligence_briefing_*

### Platform Request & Voting
- Migration: `0035_platform_requests` + `0036` (realtime publication)
- Tables: `platform_requests` (unique name, status, vote_count) + `platform_request_votes` (composite PK, one vote per user)
- Vote count recomputed from the votes table on every write (no drift under concurrent voting)
- `GET/POST /api/platform-requests`, `POST/DELETE /api/platform-requests/[id]/vote`
- `PlatformRequestBoard` on `/platforms` — realtime vote counts via Supabase publication

---

## 🌐 Phase 10 — Public Pages & SEO

| Page | Purpose |
|------|---------|
| `/home` | Marketing homepage (StoryBrand: Character → Guide → Plan → CTA) |
| `/pricing` | 3 self-serve cards (Free/Founder/Pro) + Agency callout → contact |
| `/competitors` (public) | Competitor Distribution Scan — top-line free, full gap behind signup |
| `/articles/[slug]` | Articles/blog (static, developer-authored) |
| `/faq` | FAQ with JSON-LD structured data |
| `/privacy` | Privacy policy |
| `/terms` | Terms of service |
| `/support` | Contact/support form (also Agency inquiry destination) |
| `/reports/[campaignId]` | Public shareable campaign report |
| `manifest.ts` | PWA manifest |
| `sitemap.ts` | Auto-generated sitemap |
| `robots.ts` | Robots.txt |

---

## 📦 Package: `packages/shared`

### Contracts (`contracts.ts`) — Single Source of Truth
- `PlatformResult`, `CampaignPayload`, `CampaignResponse`, `SubmissionStatus`
- `LandingPageAuditResult`, `AuditCategory`, `AuditCategoryName`
- `VisibilityQueryType`, `QUERY_TYPE_WEIGHT`, `CategoryOwnership`, `ShareOfVoiceEntry`
- `SurfaceCategory`, `SurfaceSubmissionType`, `Surface`, `SurfaceStatus`
- `ReviewPlatform`, `ReviewRecipientInput`, `ReviewCampaignFunnel`
- `ContentType`, `GeneratedContentView`
- `FounderPlatform`, `FounderPlatformScore`, `FounderAuditResult`
- `CommunitySurface`, `CommunityOpportunity`, `CommunityResponseView`
- `ReferralStructure`, `ReferralProgramCopy`, `ReferralProgramView`
- `PlatformRequest`, `PlatformRequestCategory/Status`
- `FeatureName`, `FeatureEventType`, `FeatureEventInput`
- `BridgeMessage` (all extension↔dashboard messages including `TRIGGER_LAUNCH`, `TRIGGER_SURFACE`, `TRIGGER_SURFACE_VERIFY`, `TRIGGER_CAPTURE`)
- `PlanId` (free / founder / pro / agency), `PLAN_LIMITS` (single source for all metering)

---

## 🛡️ Security Audit Findings (All Verified Safe)

- `dangerouslySetInnerHTML` in articles page — static developer-authored constant only
- `dangerouslySetInnerHTML` in FAQ — static hardcoded FAQS constant only
- JSON-LD payloads escape `<` as `\u003c` (defense in depth)
- Competitor scan API: typed `unknown` narrowing, string validation, length caps
- All RLS policies: cross-user read = zero rows
- Admin routes: server-side role check, never CSS-hidden

---

## 🚦 Current Status: Feature Freeze

**Feature freeze active** as of the last commit. 36 migrations written (most pending Supabase apply).

### ✅ Fully Complete (Code)
All 10 phases above are implemented in code.

### ⏳ Ops Pending (Not Code)
- Apply migrations 0023–0036 in Supabase
- Paystack Pro plan env vars (`PAYSTACK_PLAN_PRO_MONTHLY/ANNUAL`)
- DKIM/SPF/DMARC + Resend domain verification
- Chrome Web Store submission
- Live adapter selector QA (run simulated campaign across all 15 platforms)
- Verify Paystack webhook delivery for live events
- `CRON_SECRET` set in Vercel

### 📊 Key Numbers
- **36** database migrations
- **25** API route groups
- **16** dashboard pages
- **15** platform adapters
- **6** acquisition features
- **5** cron jobs (Vercel-scheduled)
- **4** plan tiers
- **25** tracked feature events
- **11+** transactional email types
