# EXECUTION_PLAN.md — greenfield build order

**Companion to BUILD_SPEC.md. Execute milestones strictly in sequence. A milestone is not done until its gate passes. Never carry a failing gate forward.**

## M0 — Monorepo bootstrap
pnpm workspace, apps/dashboard (Next 15) + apps/extension (Plasmo MV3) + packages/shared, CI per-app builds, Vercel root dir apps/dashboard → beta.usersessions.io.
**Gate:** clean clone + pnpm install + both apps build; Vercel deploys.

## M1 — Shared contracts & design system
contracts.ts (PlatformResult, TelemetryBatch, statuses, PlanId, bridge messages, UTM helper) + tokens.css consumed by BOTH apps. DESIGN.md committed.
**Gate:** both apps render status badges pixel-identically from shared tokens; grep finds zero hex outside tokens files.

## M2 — Supabase: schema, RLS, seeds
Migrations 0001–0004 + seed (15 wedge platforms with editorial scores, flags).
**Gate:** cross-user read from second account returns zero rows on every user-scoped table; seed idempotent.

## M3 — Dashboard shell: auth + layout
Magic link + Google (Supabase), /auth/callback ALWAYS creates profiles row, middleware guards, sidebar layout, product switcher stub.
**Gate:** fresh magic-link sign-in lands on honest empty Overview; profiles row exists; non-admin never sees admin nav.

## M4 — Extension core
MV3 minimal permissions, background loop skeleton (MV3-safe pause/resume, rate limit + jitter, CAPTCHA relay plumbing), content extraction, popup shell, ExtensionBridge SET_TOKEN incl. on token refresh.
**Gate:** unpacked extension receives real token from deployed dashboard; extracts site data from a test page.

## M5 — AI copy generation + approval UI
Gemini batch generation per platform category; every word editable; telemetry captured per shared TelemetryBatch.
**Gate:** real page → copy for all wedge categories → edits persist to payload.

## M6 — Adapters: 3 pilots, then 15
3 highest-editorial-score wedge adapters first (form fill, multi-step, awaiting_email_verification, CAPTCHA pause, screenshot, simulated mode). **Gate A:** all 3 pass simulated AND one real submission. Then replicate to remaining wedge platforms; deactivate any that can't pass. **Gate B:** every active platform has a passing adapter; UTM verified on every URL.

## M7 — Ingestion + Distribution Score (the loop closes)
POST /api/campaigns (Bearer, upsert, synchronous score recompute), POST /api/telemetry/ai-edits (always 200), score formula validated on seeded data.
**Gate (the heartbeat):** one real end-to-end campaign produces correct campaigns/submissions/distribution_scores rows. Nothing proceeds without it.

## M8 — Dashboard surfaces
Overview (Realtime), Campaigns, Listings, Platforms, Analytics, /reports/[id] (public, print), TrendChart with honest empty state.
**Gate:** every page renders M7's real data; incognito report loads; full token audit passes.

## M9 — Monitoring engine
Hardened link-check (GET fallback, backoff, 48h grace), indexation, resubmission queue, notifications, new-platform drops, weekly Resend digest, cron_logs.
**Gate:** broken test URL survives 48h grace then flips removed + notification + recompute; digest renders real data.

## M10 — Measurement moat *(Phase −1 validation must be passing)*
Platform Quality Score cron; AI Visibility (queries, weekly multi-engine cron, verbatim snippets, score + trend); Competitor Distribution Scan; preflight route + popup warnings.
**Gate:** dogfood product shows real visibility history; mismatched pair triggers a preflight warning.

## M11 — Monetization (Paystack)
Currency approval pre-check; Plans; fail-closed flags; /pricing 404 while off; Initialize Transaction checkout; HMAC-SHA512 webhook (4 events, store email_token); metering → PLAN_LIMIT_EXCEEDED; extension limit UI.
**Gate:** test-mode subscribe/cancel round-trip updates profiles; at-limit account rejected with exact code; popup shows upgrade state.

## M12 — Admin
Server-side redirects; system/users/flags/billing/adapters/data-quality; append-only audit log on every mutation; time-limited bannered impersonation.
**Gate:** non-admin hard-redirects; every admin mutation produces an audit row.

## M13 — Homepage & launch
StoryBrand exactly; CTA verbatim ×3; competitor scan + real dogfood report; real screenshots; zero fabricated numbers; name decision confirmed; store listing with minimal-permissions privacy policy.
**Gate:** line-by-line review against BUILD_SPEC §2; store submission accepted.

## Environment variables
NEXT_PUBLIC_SUPABASE_URL · NEXT_PUBLIC_SUPABASE_ANON_KEY · SUPABASE_SERVICE_ROLE_KEY · GEMINI_API_KEY · RESEND_API_KEY · RESEND_FROM · PAYSTACK_SECRET_KEY · PAYSTACK_PUBLIC_KEY · CRON_SECRET · NEXT_PUBLIC_EXTENSION_ID · NEXT_PUBLIC_SITE_URL=https://beta.usersessions.io
