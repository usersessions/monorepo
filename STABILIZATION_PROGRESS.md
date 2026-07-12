# Monorepo Stabilization Progress

## Constraints respected
- No changes were made to `apps/extension/src/adapters/registry.ts` selectors, URLs, or `verified` flags.

## Phase 1: Engine Resilience — DONE
- `apps/extension/src/background.ts`
  - **Before:** `waitForTabLoad` rejected unhandled when the target tab was closed mid-load.
    **After:** `.catch()` guard resolves gracefully.
  - **Before:** `RESUME_USER_ACTION` sent a message to a possibly-closed paused tab, hanging the resume flow.
    **After:** paused tab existence is checked first; the platform fails gracefully and the campaign continues.
  - **Before:** the runtime message listener's async body could throw before `sendResponse`, hanging the port.
    **After:** top-level `try/catch` guarantees every message receives a response.

## Phase 2: Type Safety & Contracts — DONE
- Audited parity across `packages/shared/src/contracts.ts`, `apps/extension/src/adapters/types.ts` (`RunContext`,
  `AdapterOutcome`, `FounderProfile`), and dashboard API routes (`/api/campaigns`, `/api/competitors/scan`,
  cron routes). `PlatformResult`, `CampaignPayload`, `CampaignResponse`, and `SubmissionStatus` are used
  consistently on both sides of the extension→dashboard boundary; no drift found.
- `apps/dashboard/app/api/competitors/scan/route.ts`
  - **Before:** request body destructured untyped (`any`), truthiness-only validation, no length caps.
    **After:** typed `unknown` narrowing, string-type validation, and length caps (query 500, name 200, url 500);
    malformed JSON returns 400 instead of throwing.
- Residual (accepted): `sendMessageWithRetry` in `background.ts` uses `any` internally for the generic
  chrome message envelope; results are cast to `AdapterOutcome` at the call sites. Low risk, internal-only.

## Phase 3: Dashboard State & UI — DONE
- `apps/dashboard/app/api/cron/competitor-scan/route.ts`
  - **Before:** unknown/free plans fell back to a 30-day scan cadence, effectively allowing runs for
    unsupported tiers.
    **After:** plans not in the interval map (`founder`, `agency`) are skipped entirely — strict tier gate.
- Supabase error guards added (errors now surface to route `error.tsx` boundaries instead of silently
  rendering empty states):
  - `apps/dashboard/app/(dashboard)/campaigns/page.tsx`
  - `apps/dashboard/app/(dashboard)/competitors/page.tsx`
  - `apps/dashboard/app/(dashboard)/notifications/page.tsx`
  - `apps/dashboard/app/(dashboard)/listings/page.tsx`
- Loading/error boundaries verified present for analytics, campaigns, competitors, listings, platforms,
  settings, admin, and reports routes.

## HTML rendering security verification — DONE (classification: ✅ SAFE)
Traced every `dangerouslySetInnerHTML` usage:
- `apps/dashboard/app/articles/[slug]/page.tsx` — `article.html` originates exclusively from the static,
  developer-authored `ARTICLES` constant in `apps/dashboard/lib/articles.ts` (compiled into the bundle).
  No user, CMS, or database content reaches this sink. **Safe.**
- `apps/dashboard/app/faq/page.tsx` — JSON-LD built from a static hardcoded `FAQS` constant. **Safe.**
- Defense-in-depth applied anyway: JSON-LD script payloads now escape `<` as `\u003c` in both pages to
  rule out `</script>` breakout if the constants ever become dynamic.

## TODO / implementation-gap inventory — TRIAGED
9 TODOs confirmed in executable extension source (8 in `adapters/registry.ts`, 1 in `adapters/types.ts`).
All relate to adapter step data or capture-engine features:

| Gap | Status | Resolution |
| --- | --- | --- |
| 16:9 hero cropping | **Shipped** | `cropDataUrl` (OffscreenCanvas, MV3-safe) center-crops hero captures in the background worker |
| Raw hero fallback | **Resolved** | Crop failures fall back to the raw shot; a submission never blocks on media |
| 1:1 logo asset | **Shipped** | `captureLogo` pulls apple-touch-icon → og:image → favicon and crops it square; assets flow through `RunAssets.logo` |
| Multi-image gallery uploads | **Shipped** | Second scrolled capture; the runner's `upload` op attaches all shots to `multiple` file inputs |
| Fuzzy multi-checkbox selection | **Shipped** | `smartFill` ticks label-matched checkboxes for category/tags groups when no text input exists |

All capture-engine gaps are closed WITHOUT touching registry step data (mandate respected).
The TODO comments remaining inside `adapters/registry.ts` are documentation only.

## Structure findings (verified, no action needed)
- Workspace structure consistent (`apps/`, `packages/`, pnpm workspace layout).
- All workspace packages define build scripts.

## Logical-flow debugging pass (post-verification)

### FIXED: "Something went wrong" crash on the user dashboard (Overview)
- **Root cause:** `apps/dashboard/app/(dashboard)/page.tsx` called `user!.id` after
  `supabase.auth.getUser()` with no null check. In the Next.js App Router the layout's
  `redirect('/login')` does NOT stop the page from rendering (layout and page render in
  parallel), so any request with a missing/expired/mid-refresh session made the Overview
  throw `TypeError: Cannot read properties of null (reading 'id')` — caught by the global
  `app/error.tsx` boundary as "Something went wrong / That was us, not you" with a ref digest.
- **Fix:** explicit `if (!user) redirect('/login')` guard before any `user.id` access.
- **Same latent bug fixed in:**
  - `apps/dashboard/app/(dashboard)/settings/page.tsx`
  - `apps/dashboard/app/(dashboard)/platforms/page.tsx`
  (Competitors already had the guard — which is why that page never crashed.)

### Verified already fixed upstream
- The invalid `.eq('simulated', false)` filter on the `campaigns` count in Settings was
  removed by the local verification push (campaigns has no `simulated` column); Settings
  now matches Overview's launch-count logic.

### Logical-flow scan results (no change needed)
- Overview, layout, and onboarding derive onboarding progress with identical rules — consistent.
- Overview "Install" step reuses `campaignCount` (same as onboarding page) — intentional per
  code comment (campaigns can only originate from the extension).
- `/api/campaigns` metering, tiers (`lib/tiers.ts`), and dashboard usage meters share the same
  `limitsFor` source of truth — no drift.
- Extension state machine statuses (`idle/running/paused/awaiting_user_action/done/plan_limit/sync_error`)
  all have handlers and exits; alarms are cleared on RESET/PAUSE — no orphan alarm paths found.

### FIXED: "Something went wrong" crash on the user dashboard — ACTUAL root cause (digest 2261792288)
- Production log: `Error: Attempted to call onboardingLabel() from the server but onboardingLabel
  is on the client.` The dashboard layout (a server component) called `onboardingLabel()` for the
  mobile nav, but the function was exported from `components/SidebarNav.tsx` — a `'use client'`
  module. In Next.js 15 client-module exports become client references; invoking one on the
  server throws on EVERY dashboard request for signed-in users.
- **Fix:** moved `onboardingLabel` + `OnboardingProgress` to a shared server-safe module
  `lib/onboarding.ts`; layout and SidebarNav now both import from there.
- The earlier null-session guard remains valid as a separate latent-crash fix.

### Billing diagnostics (live-payments readiness)
- Verified: the code has NO test/live mode switch — mode is determined entirely by the
  `PAYSTACK_SECRET_KEY` prefix (`sk_test_` vs `sk_live_`) and the plan codes' mode.
- `lib/billing/paystack.ts` / `api/billing/checkout` / `pricing` now propagate the exact
  Paystack rejection reason (status + provider message) to the pricing banner instead of a
  blind "could not start this checkout", so misconfigured keys/plan codes are self-diagnosing.
- **FIXED (provider 400: Invalid Amount Sent):** Paystack's `transaction/initialize` requires
  an explicit `amount` even for plan subscriptions. `initializeTransaction` now looks up the
  plan via `GET /plan/:code` and passes its amount through; the plan amount remains
  authoritative on Paystack's side.
- **FIXED (cancel/downgrade "Could not cancel automatically"):** cancellation depended on
  `paystack_subscription_code` + `paystack_email_token` stored by the `subscription.create`
  webhook; when that event is missed the cancel dead-ends. The cancel route now self-heals by
  recovering the active subscription's code + email token live from Paystack via the stored
  customer code (`findActiveSubscription`), persisting them, then disabling auto-renew.
- Resolved in production config (not code): Paystack IP whitelist cleared (provider 401:
  "Your IP address is not allowed" from Vercel's dynamic egress IPs).

## Pricing restructure (research-backed, July 2026)
- **New structure:** 3 self-serve cards (Free / Founder ⭐ $39 / Pro $99) + visually separated
  **Agency & Enterprise callout** ("Custom pricing, from $299/mo") routing to the contact flow
  (`/support`) instead of self-checkout — per 2026 benchmarks (demos outperform self-serve at
  $200+; floor price increases qualified leads; enterprise as a 4th equal column distorts anchoring).
- **New `pro` plan** wired end to end: `PlanId` in shared contracts, `PLAN_LIMITS` (10 products,
  10 launches/product/mo, 15 visibility queries/product), Paystack plan keys
  `PAYSTACK_PLAN_PRO_MONTHLY` / `PAYSTACK_PLAN_PRO_ANNUAL`, checkout `PAID_PLANS`,
  webhook `planIdFromCode`, and platforms-page tier gating (free 0 < founder 1 < pro 2 < agency 3).
- **Agency self-checkout removed from the page** (grandfathered subs keep working —
  `agency_monthly` remains valid in checkout and webhook).
- **Reason-mapped cancel flow** at `/settings/cancel`: one required question, ONE mapped save
  offer (price/usage → downgrade to Founder; timing → 60-day pause via support; feature/other →
  support), then one-click cancel always visible. Single-offer design keeps CA ARL compliance.
- **Deferred (product decision + metering change):** free-tier reverse trial (1 full launch +
  30 days of full monitoring, then decay to read-only). Requires signup-date-based metering in
  /api/campaigns — tracked as the next pricing iteration.
- **Ops prerequisites:** create live Paystack plans for Pro ($99 monthly / $990 annual) and set
  the two new env vars in Vercel before the Pro buttons will checkout (until then they surface
  the explicit not_configured banner naming the missing variable).

## Deferred items — now CLOSED
- **Free-tier reverse trial (shipped):** `PlanLimits` gains `trialDays` + `lifetimeLaunchCap`;
  free = 30 days of full live access from signup + 1 lifetime live launch (distinct live
  campaigns, metered in /api/campaigns via non-simulated submissions). Lifetime 3-submission
  cap removed; pricing card copy updated to match. Simulated runs remain always free.
- **16:9 hero cropping (shipped):** `cropDataUrl` in the background worker (OffscreenCanvas +
  createImageBitmap, MV3-safe) center-crops hero captures; falls back to the raw shot on error.
- **Multi-image gallery uploads (shipped):** capture engine now also takes a second scrolled
  shot (`chrome.scripting`); `RunAssets.productGallery` carries it; the runner's `upload` op
  attaches every available shot to `multiple` file inputs. No registry step changes needed.
- **Fuzzy multi-checkbox selection (shipped):** `smartFill` for `category`/`tags` now falls
  back to ticking visible checkboxes whose labels match approved values when no text input
  exists. No registry step changes needed.
- Registry TODO comments remain as documentation only — registry.ts untouched per mandate.

## How the system works end-to-end (launch reference)

### 1. Connect
- User signs in on the dashboard (Supabase magic link). `ExtensionBridge` (dashboard) hands the
  Supabase access token to the extension via postMessage + `chrome.runtime.sendMessage`, with a
  race-proof retry/ack handshake. Token refreshes are re-delivered automatically.

### 2. Analyze & approve
- On the founder's landing page, the extension's extract content script reads title,
  description, keywords, and headings into `SiteData` (stored in `chrome.storage.local`).
- The popup calls `POST /api/ai/copy` (Bearer-authed; Gemini key stays server-side) to generate
  per-category listing copy. The founder edits and approves every word before anything runs.
- Founder profile (name, email, tags, socials) auto-fills from `GET /api/profile` and is editable.

### 3. Launch (campaign loop — background service worker)
- `START_CAMPAIGN` builds `CampaignRunState` in `chrome.storage.local`; per-platform live/sim
  mode is FAIL-CLOSED: an adapter runs live only if registry-verified or user-verified via
  `adapter_verifications`. Requested simulations simulate everything.
- Platforms run one at a time with human-mimicking pacing (45-75s live, 2s sim) via
  `chrome.alarms` — the whole run survives MV3 worker restarts.
- Per platform: a tab opens the submit URL; the capture engine (when the adapter needs media)
  grabs a 16:9 hero, a scrolled gallery shot, and a 1:1 logo; the generic adapter-runner
  executes the declarative steps (fill/smartFill/select/check/upload/next/waitFor/submit).
  Simulation always stops before submit. CAPTCHA/OTP/login pause the run
  (`awaiting_user_action`) with badge + system notification; the human acts, then resumes
  (closed paused tabs fail gracefully and the campaign continues).

### 4. Sync (the heartbeat)
- Queue drained → `POST /api/campaigns` (Bearer + rate-limited): validates payload, verifies
  product ownership (bootstraps the product on first run), METERS the plan (reverse-trial window
  + lifetime live-launch cap for free; monthly launches per product for all), upserts the
  campaign, inserts one submission row per platform, writes a notification, and recomputes the
  Distribution Score synchronously. Failed syncs NEVER drop results — `sync_error` state retries
  on an alarm, on demand, and on fresh tokens. `PLAN_LIMIT_EXCEEDED` is surfaced distinctly.

### 5. Watch (dashboard + crons)
- Realtime: Supabase publications drive `RealtimeRefresh` (server re-render) and
  `NotificationToaster` the moment the extension syncs.
- Crons (Bearer `CRON_SECRET`, all outcomes logged to `cron_logs`): link-check (48h dead-link
  policy → resubmission queue), ai-visibility (weekly verbatim engine checks), competitor-scan
  (plan-gated cadence: founder 7d / agency 1d; free skipped), platform-quality, weekly-digest.

### 6. Billing lifecycle
- Pricing: Free (reverse trial: 1 product, 1 full live launch, 30 days full monitoring) /
  Founder $39 / Pro $99 (annual default, 17% off) + Agency/Enterprise → contact flow.
- Checkout: `POST /api/billing/checkout` → plan lookup (amount) → Paystack authorization URL.
  Failures redirect to /pricing with the provider's exact reason.
- Webhook (HMAC-verified): charge.success / subscription.create (stores subscription_code +
  email_token; auto-disables any PREVIOUS subscription so plan switches never double-bill) /
  subscription.disable (downgrade to free) / invoice.payment_failed (status 'attention').
- Cancel: /settings/cancel — one reason question, one mapped save offer (downgrade / pause /
  support), one-click cancel; the API self-heals missing codes from Paystack before disabling.

## Remaining gaps & pre-launch recommendations (honest list)
1. **Adapter selectors are the #1 launch risk.** Registry selectors/URLs are locked and marked
   PROVISIONAL in places — they can only be proven against the LIVE sites. Recommendation: run a
   simulated campaign against all 15 platforms and a live run on 2-3 verified ones before launch.
2. **Paystack webhook delivery is a single point of truth** for plan upgrades. Verify the LIVE
   webhook URL and send a test event from the Paystack dashboard. (Cancel self-heals; upgrade
   does not — a missed charge.success leaves a paying user on free.)
3. **Plan-switch race:** the old-subscription auto-disable can race Paystack's own
   subscription.disable event; worst case is status text, never double-billing. Acceptable, monitor.
4. **Existing free users older than 30 days** lose live-launch access the moment the reverse
   trial deploys (trial is measured from signup). If any real free users predate launch, decide
   whether to grandfather them (e.g. measure from deploy date) before shipping.
5. **Pro plan env vars** (`PAYSTACK_PLAN_PRO_MONTHLY/ANNUAL`) must exist in Vercel or Pro buttons
   show the not-configured banner.
6. **Extension review lag:** Chrome Web Store review takes days — submit the new build BEFORE the
   marketing push. The dashboard can deploy independently.
7. **Logo/gallery capture is best-effort** (favicon/og:image quality varies). Platforms with
   strict image validation may still reject; the run fails honestly per-platform, never silently.
8. **`vercel.json` cron schedules** must match the five cron routes; confirm they exist and
   `CRON_SECRET` is set, or monitoring silently never runs (fail-closed by design).

## Email Design System v1.0 (implemented)
- New shared module `apps/dashboard/lib/email/template.ts`: dark-first 600px layout (ink/ink2
  tokens, wordmark header, hero, footer with preference link + optional `EMAIL_POSTAL_ADDRESS`
  for CAN-SPAM), plus components `dataTable`, `statusBadge`, `metricCard`, `ctaButton`, and
  `escapeHtml`. Inline styles with `!important` colors + dark color-scheme metas per spec.
- Refactored onto the system: **weekly digest** (metric cards + CTA) and **competitor scan**
  (data table + status badges). Fixed an HTML-injection vector: competitor queries/names were
  previously interpolated unescaped into email HTML.
- New transactional emails wired into the Paystack webhook: **Payment received** (receipt
  table) and **Payment failed** (dunning + Settings CTA). Both fail-soft.
- Remaining from the email checklist (ops/dashboard, not repo code): Supabase Auth templates
  (pasted in the Supabase dashboard), DKIM/SPF/DMARC records, Resend domain verification,
  client-matrix + dark-mode testing, spam-score check. Additional lifecycle emails (welcome,
  listing live/rejected, usage warnings, security alerts) can now be added in minutes on the
  shared template.

## Lifecycle emails (implemented, wired to real triggers)
- **Welcome** — `auth/callback/route.ts`, fires once on first-ever profile creation
  (detected via a pre-upsert existence check, not a fragile `ignoreDuplicates` return value).
- **Admin new-signup alert** — same trigger, sent to the admin address.
- **Campaign complete / simulation finished** — `api/campaigns/route.ts`, fires when a synced
  payload includes `finishedAt`; mirrors the existing in-app notification with a per-platform
  status table.
- **Usage limit warning (80%)** — same route, fires once per launch that crosses 80% of the
  product's monthly quota, before the hard 100% `PLAN_LIMIT_EXCEEDED` block.
- **Listing live** — `cron/link-check/route.ts`, on `submitted → live` promotion.
- **Listing rejected / dead** — same cron, on confirmed 48h dead-link (free-plan path; the
  founder/agency auto-resubmit path keeps its existing distinct notification).
- **Payment received / Payment failed** — already wired to the Paystack webhook (previous commit).
- All new sends are `void`-fired (never block the response) and fail-soft (a Resend outage
  never breaks ingestion, auth, or the cron).
- **Deferred (needs infra, not templating):** security alert (new login) requires device/IP
  fingerprinting and a known-devices table that do not exist yet — wiring it now would either
  fire on every magic-link sign-in (noise) or require new schema. Support ticket created/resolved
  emails are deferred until a support-ticket table/flow exists in this app (currently email-only
  support). Invoice-ready is covered by the payment-received receipt; a dedicated invoice PDF
  is a Paystack portal feature, not built here.

## Email infrastructure (monitoring + fallbacks)
- **Plain-text fallbacks (every email):** `sendEmail` now auto-derives a text part from the
  HTML (`htmlToText`) unless an explicit `text` is provided — improves spam scoring and
  accessibility for every template already shipped, with zero call-site changes.
- **Resend event webhook:** `POST /api/webhooks/resend` — svix signature verification
  (HMAC-SHA256 over `id.timestamp.payload`, 5-min replay window, fail-closed without
  `RESEND_WEBHOOK_SECRET`) — logs sent/delivered/opened/clicked/bounced/complained into the
  new `email_events` table (migration 0022, RLS service-role only).
- **Ops to activate:** run migration 0022 in Supabase; in the Resend dashboard add the webhook
  endpoint `https://<domain>/api/webhooks/resend`, copy its signing secret into
  `RESEND_WEBHOOK_SECRET` on Vercel; verify the domain + DKIM/SPF/DMARC records.

## Runner reliability (real fix for the extension failure log)
The "could not locate a 'title' field" / "missing wizard control" failures were selector/
detection gaps, NOT a bot-detection problem. Fixes (no registry.ts changes, no fingerprint
spoofing, human-in-the-loop preserved):
- Expanded `FIELD_HINTS` synonyms (product/tool/app/startup name, live/demo url, elevator
  pitch, detailed description, is-it-free, x handle, repository, etc.).
- `semanticText` now also reads `title`/`data-testid` and a visual-proximity heading/label
  from the field's container — catches forms whose label is a div/span, not a <label>.
- `smartFill` positional tiebreak: the first visible text input is used for title/tagline
  when nothing else scores (value must still be present — never invents data).
- Product Hunt "message channel closed" bug fixed: the RUN_ADAPTER listener now always
  responds, including on throw (`.catch(() => sendResponse(failed))`).
- Added honest human-paced gaps (250-700ms) between field fills as politeness/rate-limiting.

### Explicitly NOT built (and why)
A fingerprint/anti-detection evasion engine (webdriver-flag removal, canvas-noise, spoofed
navigator.plugins, keystroke-mimicry to defeat bot detection) was requested but declined: it
contradicts this product's own "assisted automation, never a spam tool / human-in-the-loop"
spec, violates target-platform terms, and is self-defeating (evading directory bot-detection
gets listings removed, destroying the Distribution Score that is the product's value). Auth /
CAPTCHA / magic-link gates keep their graceful pause-for-human flow.

## Feature A: AI-Readable Landing Page Audit (AIO Audit) — SHIPPED
- **Contracts (single source of truth):** `LandingPageAuditResult`, `AuditCategory`,
  `AuditCategoryName`, `AuditResponse`, `AuditApiError` in `packages/shared/src/contracts.ts`.
- **Migration 0023:** `landing_page_audits` (append-only, RLS select-own; inserts via service
  role only after ownership + cadence checks).
- **`POST /api/audit`:** auth + product-ownership validation; server-side fetch (12s timeout,
  500KB cap, graceful FETCH_FAILED); 7 scored categories (H1 clarity [Gemini-refined when a key
  is set, heuristic otherwise], FAQ, comparison, JSON-LD, social proof, pricing clarity, meta
  description); overall 0-100; lowest-fraction category becomes topPriority. Cadence-gated
  (1/week free+founder, 1/day pro+agency) returning PLAN_LIMIT_EXCEEDED, plus a rate-limit
  backstop. No fabricated data.
- **Dashboard `/audit`:** server page (honest empty states for no-product / no-URL) + client
  `AuditRunner` scorecard (serif metric, DM Mono data, cyan=actionable / green/amber/red state
  meters, top-priority callout, re-run button) + loading + error boundary. Added to sidebar nav.
- Vocabulary honoured: “distribution / visibility / AI Answer Ownership”, no “SEO”/“backlinks”.
- Features B/C/D NOT started (per the build order: A ships and is verified first).

## Feature B: Category Query Ownership — SHIPPED
- **Contracts:** `VisibilityQueryType`, `QUERY_TYPE_WEIGHT`, `VisibilityQuerySummary`,
  `ShareOfVoiceEntry`, `CategoryOwnership` in `packages/shared/src/contracts.ts`.
- **Migration 0024:** `visibility_queries` gains `category_tag` + `query_type` (checked enum,
  default `category_direct`); new `visibility_competitors` (denormalized share-of-voice,
  unique per query+competitor+engine, RLS select-own, service-role writes).
- **Cron upgrade (`/api/cron/ai-visibility`):** now stores the FULL recommendation list per
  check and upserts every non-self recommendation into `visibility_competitors` for share of
  voice. Verbatim snippet storage and honest 'not mentioned' recording unchanged; weekly/monthly
  cadence unchanged. (Query-type variety comes from user-tracked queries tagged by type, not
  fabricated — the five example patterns are the suggested set; no invented queries are inserted.)
- **Category Ownership Score:** computed in `/analytics` from each query's latest check,
  weighted by `QUERY_TYPE_WEIGHT` with a gentle rank decay (never below 40%). Null until real
  checks land — no estimates.
- **Analytics upgrade:** new “Category Ownership” card (score + share-of-voice bars: you vs top
  3 competitors + gap indicator), query rows now show their type; add-query form gains a
  query-type selector. `addVisibilityQuery` action persists `query_type` + `category_tag`.
- **APIs:** `GET /api/visibility/queries` and `GET /api/visibility/competitors` (auth + RLS,
  owner-scoped, optional `productId`).
- Vocabulary honoured (distribution/visibility/AI Answer Ownership); no SEO/backlinks.
- Features C/D NOT started (build order).

## Feature B addendum: AI-assisted query suggestions — SHIPPED
- **Contracts:** `SuggestedQuery`, `SuggestQueriesResponse`.
- **`POST /api/visibility/suggest`:** auth + product-ownership + rate-limit; Gemini proposes 5
  category queries (one per type where sensible) inferred ONLY from the product's name/URL.
  Persists NOTHING — pure suggestion. Honest guardrail in the prompt: fall back to
  category/use-case queries when no real competitor is confidently known (no invented rivals).
- **UI (`SuggestQueries.tsx`):** “Suggest queries with AI” button on `/analytics`; each
  suggestion is editable and must be explicitly Approved (or dismissed) before saving.
- **`approveSuggestedQuery` action:** same ownership + plan-limit checks as manual add; only
  writes on approval. Keeps the “zero fabricated data / user approves every query” rule intact.

## Feature C: AI Training Surface Expansion — SHIPPED (dashboard + API)
- **Reddit intentionally EXCLUDED** per owner experience: Reddit's automation/self-promotion
  detection bans real user accounts; seeding it would expose users to the same harm. Documented
  in migration + contracts.
- **Contracts:** `SurfaceCategory`, `SurfaceSubmissionType`, `Surface`, `SurfaceStatus`,
  `SurfaceCopyResponse`.
- **Migration 0025:** `surfaces` catalog (RLS: authenticated read, service-role write) seeded
  with GitHub Awesome Lists, Dev.to, Hashnode, Indie Hackers, Stack Overflow, X/Twitter
  (tier-gated 0-2, no Reddit). `submissions.surface_id` added (nullable; reuses the table).
- **`POST /api/surfaces/copy`:** Bearer (extension), tier-gated by `surfaces.tier_unlock`,
  Gemini drafts surface-specific honest copy (GitHub PR / blog outline / IH post / SO answer
  skeleton / pinned tweet). Draft only — never auto-posts; anti-hype + no upvote-begging guards.
- **Dashboard `/surfaces`:** quality-sorted, category-grouped grid; locked surfaces shown at
  reduced opacity with the unlock tier. Added to sidebar nav. `planRank` helper added to tiers.
- **NOTE / deferred:** the in-page extension “Distribute to Surfaces” floating sidebar + copy
  buttons are an extension build item (Plasmo content script). The dashboard, catalog, tier
  gating, and copy API are live; the extension UI is the remaining slice of C and is tracked
  as the next extension release alongside the selector-QA work.

## Feature D: Competitive Intelligence Briefings — SHIPPED
- **Migration 0026:** `intelligence_briefings` (append-only weekly snapshot, RLS select-own,
  service-role writes).
- **`/api/cron/intelligence-briefing`:** weekly, PAYING users only. Assembles 4 real-data
  sections from tables we already populate (new competitor appearances from
  `visibility_competitors`, new catalog platforms, category query flips from
  `visibility_checks`); stores a snapshot and sends a design-system email. Sections with no
  signal are omitted — never padded; users with zero news get no email.
- **`/competitors` upgrade:** “Weekly briefing” card (new competitors / new platforms / queries
  to defend) with a “competitor moved” alert badge and honest empty state.
- **`vercel.json`:** registered `intelligence-briefing` (Mon 09:00 UTC) and also added the
  previously-unscheduled `competitor-scan` cron (daily 05:00).
- Note: spec asked for “Mondays 09:00 user timezone”; Vercel crons are UTC-only, so this runs
  09:00 UTC (documented deviation — per-user-timezone scheduling would need a DB-driven queue).
- “Recommended response” CTA present in both the email and the dashboard card.

## Pivot features A-D: COMPLETE (with tracked remainders)
Remaining slices, all documented above: the extension “Distribute to Surfaces” in-page UI
(Plasmo content script) is the one unbuilt part of Feature C; everything else (A, B, B-suggest,
C dashboard/API/schema, D) is shipped on main.

## Cron scheduling decision: Vercel Cron is the single scheduler
- **Chosen: Vercel Cron** (not pg_cron). Rationale: every job is an HTTPS route with
  `authorizeCron` bearer auth that calls external services (Gemini, Resend, fetches) — not pure
  SQL — so native Vercel Cron needs zero extra infra (no `pg_net`/`pg_cron`/vault, no secret
  stored in Postgres) and keeps schedules in-repo beside the code.
- **`vercel.json`** holds all six crons: link-check (daily 03:00), platform-quality (daily
  03:30), ai-visibility (Tue 06:00), competitor-scan (daily 05:00), intelligence-briefing
  (Mon 09:00), weekly-digest (Mon 08:00). All UTC.
- **Removed `0016_pg_cron_setup.sql`** so pg_cron never double-fires these routes. It was never
  applied to the live DB (never pushed), and contained only pg_cron scheduling (extensions +
  `trigger_cron_endpoint` + `cron.schedule` calls) — nothing else depended on it, so deletion is
  safe. Do NOT schedule these `/api/cron/*` routes from pg_cron.
- Ops confirmed: Vercel Cron enabled and `CRON_SECRET` set; watch `cron_logs` for first runs.

## Feature C completion: extension “Distribute to Surfaces” flow — SHIPPED
- **`GET /api/surfaces`** (Bearer): tier-annotated surface catalog for the extension
  (`unlocked` per caller plan).
- **Extension `surfaces.ts`:** `fetchSurfaces` + `fetchSurfaceCopy` clients (token from storage,
  draft copy only).
- **Content script `contents/surface-sidebar.ts`:** on-demand floating sidebar (shadow DOM, design
  tokens) with editable draft, Copy-to-clipboard, Take-screenshot (proof), and Mark-as-submitted.
  Assisted only — the human posts it in their own account; nothing auto-submits.
- **Background handlers:** `GET_SURFACES`, `DISTRIBUTE_SURFACE` (opens the surface tab, drafts
  copy, injects the sidebar), `SURFACE_SCREENSHOT` (captureVisibleTab proof), and
  `SURFACE_MARK_SUBMITTED`.
- **`surfaces-submit.ts`:** records the human-posted submission through the existing
  `/api/campaigns` heartbeat using `platformId: "surface:<id>"` — no ingest-schema divergence;
  the monitoring loop verifies it like any listing.
- Feature C is now fully closed (dashboard + API + schema + extension UI). All four pivot
  features (A, B, B-suggest, C, D) are complete on main.

## Remaining code items — SHIPPED (Gemini-only kept; multi-engine intentionally deferred)
- **Popup “Distribute to Surfaces” UI (`SurfacesPanel.tsx`):** lists the tier-annotated catalog
  (`GET_SURFACES`), gates locked surfaces, and starts the flow — `DISTRIBUTE_SURFACE` for
  assisted_manual, `VERIFY_SURFACE` for tracked_only. Mounted in the popup after LaunchPanel.
- **tracked_only “verify my profile” flow:** new `VERIFY_SURFACE` + `SURFACE_VERIFY_MENTION`
  background handlers and a `renderVerifyPanel` in the surface sidebar. Verify reads the current
  tab's visible text (via `chrome.scripting`) for the product name or domain; on a real match it
  records the submission through the campaigns heartbeat. Honest — no match, no record.
- **Surface monitoring:** link-check cron now selects `surface_id` alongside `platform_id`, so
  surface posts with a listing URL enter the same 48h dead-link / promotion / resubmission loop
  as directory listings.
- Multi-engine AI visibility remains Gemini-only by decision (cost); copy stays honest about
  single-engine coverage.

## Surface status — dedicated per-surface state (follow-up SHIPPED)
- **Migration 0027:** `submissions.surface_status` column (checked enum
  in_progress/submitted/verified/rejected; null for directory rows) + partial index on
  `surface_id`.
- **Contract:** `surfaceStatusFrom(surface_status, submission_status)` maps a row to a
  `SurfaceStatus`, authoritative when the dedicated column is set, else derived from the generic
  status for legacy rows. `PlatformResult.surfaceStatus` added.
- **Ingest (`/api/campaigns`):** `surface:<id>` results now split into `surface_id` +
  `surface_status` (platform_id left null), so surfaces and directories are cleanly distinct rows.
- **Extension:** `postSurfaceSubmission({ verified })` sends `verified` for tracked_only on-page
  confirmations and `submitted` for freshly posted assisted_manual.
- **Monitoring (link-check):** reachable surface post → `surface_status='verified'`; confirmed
  48h dead → `'rejected'` (both free and paid paths).
- **Dashboard `/surfaces`:** each unlocked surface now shows its real per-user status
  (Not started / In progress / submitted / verified / rejected) with the matching status colour.
- Also: link-check auto-resubmission now includes the `pro` plan (was founder/agency only).

## Acquisition Feature 1: Review Generation System — SHIPPED
- **Migration numbering corrected:** spec said `0024_review_system.sql` but 0024 is taken
  (category_ownership) and the tree is at 0027 — shipped as **`0028_review_system.sql`**.
- **Ethics guardrail:** built as an honest-review REQUEST engine only. No review-gating, no
  incentives, no fake reviews; the AI prompt explicitly asks for an honest (not positive) review.
- **Contracts:** `ReviewPlatform`, `ReviewRecipientInput`, `ReviewRequestView`,
  `ReviewCampaignFunnel`, `ReviewRequestStatus`, `ReviewApiError`, `ReviewCampaignResponse`.
- **Tiers:** added `reviewCampaignsPerMonth` (free 0, founder 1, pro 3, agency null=unlimited)
  and `reviewRequestsPerCampaign` (0/50/200/1000).
- **Migration 0028:** `review_platforms` (seeded G2, Capterra, Trustpilot, Product Hunt, Chrome
  Web Store; tracked_only), `review_campaigns`, `review_requests`; RLS select-own + service-role
  writes; platform catalog readable by authenticated users.
- **APIs:** `POST /api/reviews/campaign` (ownership + monthly cap + per-campaign clamp; AI-drafts
  one personalized honest email per recipient, referencing their real activation event; persists
  drafts, returns them for editing), `POST /api/reviews/send` (RLS-checked, Resend, marks sent,
  fail-soft), `GET /api/reviews/campaigns` (cumulative funnel), `GET /api/reviews/platforms`
  (tier-annotated).
- **Dashboard `/reviews`:** paid-feature gate for free, 4-step builder (recipients → platform →
  AI drafts → edit → approve & send), and per-campaign sent/opened/clicked/reviewed funnel.
  Added to sidebar nav.
- **Funnel note:** opened/clicked require the Resend event webhook (already built) to map events
  onto requests; a follow-up will match `email_events` → `review_requests` by recipient to
  advance statuses beyond 'sent'. Sent + reviewed (manual) work today.
- Features 2-6 NOT started (build order).

## Review funnel completion + Feature 2 — SHIPPED
- **Review funnel opened/clicked (the flagged Feature 1 gap):** the Resend event webhook now
  advances `review_requests` on `email.opened` → `opened` and `email.clicked` → `clicked`,
  matching the most recent `sent` request by recipient email, monotonic (never downgrades).
  Sent/opened/clicked/reviewed now all populate.

## Acquisition Feature 2: Comparison Content Generator — SHIPPED
- **Contracts:** `ContentType`, `GeneratedContentView`, `ContentApiError`, `ContentGenerateResponse`.
- **Tiers:** `contentPerMonth` (free 0, founder 2, pro 10, agency unlimited).
- **Migration 0029:** `generated_content` (RLS select-own + update-own so the founder can set a
  published_url; service-role insert after metering).
- **`POST /api/ai/content`:** server-side Gemini drafts vs-page / roundup / alternative / FAQ as
  editable Markdown + a schema.org JSON-LD suggestion. Honest guardrails (no fabricated
  benchmarks, fair to competitors, no SEO/backlinks/hype words). Metered; nothing auto-published.
- **`/api/content` (GET/POST):** list + save drafts with optional published URL (ownership-checked).
- **Dashboard `/content`:** paid gate for free, generator (product + type + up to 3 competitors
  pulled from competitor-scan data), editable markdown, schema suggestion, Copy Markdown /
  Download HTML / Save draft, and a saved-drafts list. Added to sidebar nav.
- **Honest deferral:** `ai_citation_count` column exists but citation monitoring (checking if AI
  cites the published page) is future work — not fabricated; stays 0 until built.
- Features 3-6 NOT started (build order).

## Acquisition Feature 3: Founder Brand Audit — SHIPPED
- **Contracts:** `FounderPlatform`, `FounderPlatformScore`, `FounderAuditResult`,
  `FounderAuditError`, `FounderAuditResponse`.
- **Tiers:** `founderAuditIntervalDays` (free 0=disabled, founder 30, pro 7, agency 7).
- **Migration 0030:** `founder_audits` (append-only, RLS select-own, service-role writes;
  stores per-platform scores JSONB + generated copy JSONB + top priority).
- **`POST /api/founder-audit`:** ownership + cadence gate (PLAN_LIMIT_EXCEEDED), best-effort
  server-side fetch of each supplied profile (LinkedIn/X/GitHub/Indie Hackers), Gemini scores
  each 0-10 with feedback + actionable suggestion + ready-to-paste optimized copy; overall
  0-100; weakest platform → topPriority. Honest: unreachable profile scores low with a clear
  reason (many block bots), never fabricated.
- **Dashboard `/founder-audit`:** paid gate for free, profile inputs, scorecard (serif metric,
  per-platform meters with state colours, top-priority callout, per-platform suggested copy with
  Copy button). Added to sidebar nav.
- Reuses the AIO Audit pattern. Features 4-6 NOT started.

## Acquisition Feature 4: Marketplace Distribution — SHIPPED
- Reuses the surfaces engine — marketplaces are a new surface **category**, not a new pipeline.
- **Contract:** `SurfaceCategory` gains `'marketplace'`.
- **Migration 0031:** widens `surfaces.category` CHECK to include `marketplace` and seeds
  Chrome Web Store, Slack Marketplace, Shopify App Store, GitHub Marketplace, Zapier Directory,
  Notion Gallery, Figma Community (all `assisted_manual`, tier-gated 1-2).
- **Copy API:** `/api/surfaces/copy` gains a `marketplace` format (tagline + description +
  feature bullets; no fabricated ratings/install counts).
- **UI:** `marketplace` category label added to the dashboard `/surfaces` grid and the extension
  SurfacesPanel — so the existing Distribute-to-Surfaces flow (open tab → draft copy → sidebar
  → mark submitted) and the link-check monitoring loop cover marketplaces with no new code.
- Assisted-manual only: the extension opens the marketplace and pre-fills a draft; the founder
  submits. No automated account creation, consistent with existing constraints.
- Features 5-6 NOT started.

## Acquisition Feature 5: Community Participation Engine — SHIPPED
- **Reddit intentionally EXCLUDED** (consistent with the surfaces decision): its self-promotion
  detection bans real user accounts. Allowed surfaces: Indie Hackers, Stack Overflow, Hacker
  News, LinkedIn, Other.
- **Contracts:** `CommunitySurface`, `CommunityOpportunityStatus`, `CommunityOpportunity`,
  `CommunityResponseView`, `CommunityApiError`, `CommunityRespondResponse`.
- **Tiers:** `communityResponsesPerMonth` (free 0, founder 5, pro 20, agency unlimited).
- **Migration 0032:** `community_opportunities` + `community_responses` (RLS all-own — the
  founder curates and posts everything themselves).
- **APIs:** `/api/communities/opportunities` (GET feed / POST manual add — curated now, future
  automated scan can POST server-side), `/api/communities/respond` (AI-draft mode is metered and
  writes an honest, help-first, non-promotional reply that mentions the product only if relevant;
  save/finalize mode records the founder's edited reply and marks the opportunity responded).
- **Dashboard `/communities`:** paid gate for free, add-opportunity form, opportunity feed with
  status, per-opportunity Generate → edit → Copy / Open post / Mark as responded. Added to nav.
- Anti-spam by design: nothing is auto-posted; every reply is drafted help-first, edited, and
  posted by the human in their own account. The “Open in tab + sidebar” extension variant can
  reuse the existing surface-sidebar later; the dashboard Copy+Open flow covers it today.
- Feature 6 NOT started.

## Feature 5 additions: in-tab reply + honest automated scan — SHIPPED
- **In-tab community reply (extension):** `RENDER_COMMUNITY_PANEL` added to the surface sidebar
  content script (editable reply, Copy, Mark-as-responded); background `OPEN_COMMUNITY_RESPONSE`
  opens the discussion tab + injects it; `COMMUNITY_MARK_RESPONDED` → `communities.ts` client
  posts back. `/api/communities/respond` now also accepts the extension Bearer token (session OR
  bearer) with explicit user_id ownership. Dashboard feed gains an “Open in tab” button.
- **Automated scan cron (`/api/cron/community-scan`, Mondays 07:00 UTC):** HONEST SOURCES ONLY —
  **Stack Overflow (StackExchange API) + Hacker News (Algolia API)**, both real public APIs.
  Derives search terms from each paid product's tracked visibility queries, writes deduped 'new'
  opportunities. Registered in `vercel.json`.
- **Deliberately NOT auto-scanned:** Reddit (bans real accounts — excluded), Indie Hackers (no
  compliant public API), LinkedIn (no compliant API; ToS/account risk). These remain manual-add,
  matching the spec's “manual curation for now” for LinkedIn and our account-safety principle.

## Acquisition Feature 6: Referral Program Generator — SHIPPED (final feature)
- **Contracts:** `ReferralStructure`, `ReferralProgramCopy`, `ReferralProgramView`,
  `ReferralApiError`, `ReferralGenerateResponse`.
- **Tiers:** `referralProgramsPerMonth` (free 0, founder 1, pro 3, agency unlimited).
- **Migration 0033:** `referral_programs` (RLS select-own + update-own for implemented_url;
  service-role insert after metering).
- **`POST /api/referrals/generate`:** ownership + monthly cap; Gemini picks a structure
  (give_get / credits / discount / cash / tiered) tuned to pricing and writes the full copy set
  (landing headline/body/CTA, in-app tooltip, invite email subject/body, social post). Honest
  guardrails (no fabricated metrics, no hype words, no SEO/backlinks). Persists the program.
- **`GET /api/referrals`:** list generated programs (owner-scoped).
- **Dashboard `/referrals`:** paid gate for free, inputs (category/value prop/pricing), suggested
  structure, per-field editable copy with Copy buttons, and a saved-programs list. Added to nav.

## Acquisition features 1-6: ALL COMPLETE
Review generation, comparison content, founder audit, marketplace distribution, community
participation (in-tab reply + honest SO/HN scan), and referral generator are all on main and
documented. Pending (ops, unchanged): run migrations 0023-0033 in Supabase; `pnpm -r build` +
tests in the IDE; Paystack Pro env vars; DKIM/SPF/DMARC + Resend domain; Chrome Web Store
submission; live adapter selector QA. Deferred by decision: multi-engine AI visibility (cost);
automated scanning of Reddit/Indie Hackers/LinkedIn (account-safety / no compliant API).

## Extension refactor: minimal action launcher — SHIPPED
- **Popup rewritten** (`popup.tsx`) to a focused launcher: wordmark + connection status, Analyze,
  “Launch directories”, “Distribute to surfaces” (in-popup catalog), a minimal status badge, and
  a link out to dashboard `/settings`. Removed from the popup: copy preview/generation UI, full
  analytics, detailed logs, billing, founder-profile card, agent panel (all owned by the
  dashboard now). Lightweight mount (no heavy state).
- **Dashboard→extension triggers:** `BridgeMessage` gains `TRIGGER_LAUNCH`, `TRIGGER_SURFACE`,
  `TRIGGER_CAPTURE`; `onMessageExternal` handles them, each GATED on a stored accessToken
  (unauthenticated pages can’t drive the extension). `externally_connectable` already scopes this
  to usersessions domains — NO new permission, NO manifest change.
- **Shared surface trigger** (`surfaces-trigger.ts`): one implementation used by both the popup
  `DISTRIBUTE_SURFACE` handler and the external `TRIGGER_SURFACE`.
- **Kept intact (no regression):** campaign loop (START/PAUSE/RESUME/RESET + alarms + sync
  heartbeat), surface handlers (VERIFY_SURFACE / SURFACE_SCREENSHOT / SURFACE_MARK_SUBMITTED),
  screenshot capture (captureVisibleTab / cropDataUrl / captureLogo), community in-tab reply,
  the try/catch + guaranteed sendResponse listener, and content scripts (extract, surface-sidebar).
- **Honest limitation:** `TRIGGER_CAPTURE` captures the user’s ACTIVE tab in the current window
  (best-effort). MV3/activeTab cannot capture an arbitrary tab from the dashboard, and we refuse
  a broader host/capture permission (CWS-friendly); it no-ops safely if the tab isn’t capturable.
- Popup source files for the removed panels (FounderProfileCard, AgentPanel, brain copy-gen)
  remain in the tree but are no longer imported by the popup — dead-code cleanup can follow once
  the IDE build confirms nothing else references them.

## Dashboard→extension trigger buttons — SHIPPED
- **Extension:** `PING` handler added to `onMessageExternal` (answers `{ok:true}`, no auth — used
  only for install detection).
- **Shared client `lib/extension-bridge.ts`:** `extensionSupported()` (chrome.runtime +
  `NEXT_PUBLIC_EXTENSION_ID`, fail-closed), `pingExtension()`, one-shot
  `triggerLaunch/triggerSurface/triggerCapture` with a 3s timeout, no polling; lastError → null.
- **`ExtensionActionButton`:** pings on mount; unsupported/not-installed → install CTA
  (`NEXT_PUBLIC_EXTENSION_STORE_URL`); no-response → honest guidance; maps NOT_CONNECTED /
  TIER_LOCKED / capture no-op to specific messages. `ExtensionStatus` = ping-only settings badge.
- **Wired exactly where specced, nowhere else:** `/campaigns` (Launch from extension on
  running/draft/ready), `/surfaces` (Open in extension on unlocked assisted_manual),
  `/audit` (best-effort Capture page + honest note), `/settings` (connection badge). NOT added to
  /analytics, /competitors, /reports, or nav.
- Fail-closed: `NEXT_PUBLIC_EXTENSION_ID` unset → every button degrades to the install CTA.
- Honest deviation: `productId`/`campaignId` args are not sent — the extension launches for the
  product it analyzed in its own storage; buttons stay truthful about that.

## Final status: COMPLETE
All three phases plus the requested security trace and TODO triage are done. Remaining deferred items are
tracked above with explicit risk and next actions.
