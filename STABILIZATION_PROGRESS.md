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

## Final status: COMPLETE
All three phases plus the requested security trace and TODO triage are done. Remaining deferred items are
tracked above with explicit risk and next actions.
