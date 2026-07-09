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

| Gap | Status | Risk | Next action |
| --- | --- | --- | --- |
| Image cropping (1:1 logo / 16:9 hero) | **Deferred** | Medium: platforms with strict image formats may reject the raw hero shot | Implement crop/resize in the capture engine (`background.ts` screenshot path); no registry change needed |
| Raw hero image used until crop ships | **Deferred** (same root cause) | Medium | Same as above |
| Multi-image gallery uploads (2–5 expected, 1 sent) | **Deferred** | Medium: submissions may be flagged incomplete on gallery-heavy platforms | Extend `RunAssets` + capture engine to produce multiple shots; registry `upload` steps unchanged |
| Fuzzy multi-checkbox selection | **Deferred** | Low: category checkboxes may be left unticked on some platforms | Extend the generic runner (`contents/adapter-runner.ts`); step data unchanged |

These are functional limitations, not crashes. None can be fully closed without either registry step-data
changes (locked by mandate) or new capture-engine work, so they are formally deferred with owners' notes above.

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

### Billing diagnostics (live-payments readiness)
- Verified: the code has NO test/live mode switch — mode is determined entirely by the
  `PAYSTACK_SECRET_KEY` prefix (`sk_test_` vs `sk_live_`) and the plan codes' mode.
- `lib/billing/paystack.ts` / `api/billing/checkout` / `pricing` now propagate the exact
  Paystack rejection reason (status + provider message) to the pricing banner instead of a
  blind "could not start this checkout", so misconfigured keys/plan codes are self-diagnosing.

## Final status: COMPLETE
All three phases plus the requested security trace and TODO triage are done. Remaining deferred items are
tracked above with explicit risk and next actions.
