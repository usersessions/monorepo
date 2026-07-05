# usersessions.io — BUILD_SPEC v2.1 (Final)

**Single source of truth. If code and this document disagree, this document wins unless a checklist item is marked verified. Database schema source of truth: `apps/dashboard/supabase/migrations/`.**

## 1. What we are building

**usersessions.io gets your product listed everywhere AI assistants and humans discover software, then monitors whether they actually recommend you.**

AI killed the barrier to building software, not the barrier to being found. Directories, AI tool indexes, and review platforms matter because **ChatGPT, Perplexity, and Gemini assemble recommendations from exactly those surfaces**. The product is a closed loop:

1. **Submit** — Chrome extension automates real listings in the founder's own browser, own session, own accounts.
2. **Verify** — Dashboard confirms listings are live and indexed; resubmits dead ones.
3. **Measure** — Weekly AI Visibility checks: does AI mention the product for its category queries?

The submission is the acquisition event. **The monitoring loop is the subscription.** We never sell a one-time thing.

### Launch wedge
**AI tool builders first.** ~15 platforms done perfectly (AI tool indexes + launch platforms). Message: *"Get your AI tool listed in every AI directory, and tracked in ChatGPT's answers."* Other categories expand after the loop is proven. Every catalog platform must have a passing adapter — no aspirational rows.

### What it is NOT (build constraints)
- **Not link spam.** No web 2.0 properties, no proxies, no farmed accounts, no automated account creation. Banned permanently.
- **Not "backlinks."** The word never appears in UI. Surfaces are **Listings**; metrics are **Distribution Score** and **AI Visibility Score**. No Domain Authority anywhere (Moz's licensed metric); quality = our computed **Platform Quality Score** (one name, everywhere).
- **Not magic.** **Assisted automation**: extension does the tedious 90%; the human handles CAPTCHAs and email confirmations, guided. Never market 100% hands-off.
- **Not a black box.** Every AI-generated word is editable pre-submission. **Zero fabricated numbers anywhere, ever.**

## 2. StoryBrand message system (governs all copy and design)

| Element | Content |
|---|---|
| Character | The founder who ships fast. Multiple AI-built products. Zero users. |
| External problem | Their product isn't listed anywhere people or AI assistants look. |
| Internal problem | "I built something real and it feels like it doesn't exist." |
| Philosophical | Good products deserve to be found. |
| Guide, empathy | Built by a founder who shipped app after app and hit the same wall. |
| Guide, authority | Real data honestly presented: verified listings, computed scores, confidence framing. |
| Plan (verbatim, everywhere) | **1. Install** the extension. **2. Launch** — approve your copy, we submit everywhere. **3. Watch** — see where you're live and whether AI recommends you. |
| Direct CTA (verbatim: nav/hero/footer/store) | **"Get your product found"** |
| Transitional CTA | Free Competitor Distribution Scan + the real dogfood campaign report. |
| Failure stakes | When someone asks ChatGPT for a tool like yours, it recommends someone else. |
| Success | Your product appears where your customers actually look — including inside AI answers. |

Rules: one CTA phrase, never varied. Marketing vocabulary: "distribution" and "visibility", never "SEO"/"backlinks". External commentary = linked citations only. Progress indicator uses exactly: Install → Launch → Watch.

## 3. Operating rules for AI builders
1. Contracts and tokens in `packages/shared` are written before code that uses them; no local mirrors — a duplicated contract type is a bug.
2. Vertical slices: thinnest end-to-end path first (3 adapters before 15).
3. Milestone gates (EXECUTION_PLAN.md) are hard. Never carry a failing gate forward.
4. No placeholder data; honest empty states only.
5. Simulation mode before live mode for every adapter.
6. Banned concepts, never build: AdSense/ad slots, proxies, web2 platforms, automated account creation, Domain Authority, Stripe, one-time SKUs, "backlinks" in UI.

## 4. Phase −1 — Validation gate (blocks net-new feature phases M10+)
- 15 discovery interviews with founders who **already spent money on visibility**. Passing: ≥5/15 paid in last 6 months; ≥half keep a half-finished directory list; **≥3 pre-pay at real prices**.
- Dogfood: launch usersessions with usersessions; that report is the permanent sample. If we can't move our own visibility, stop and rework before charging anyone.

## 5. Design system
See `DESIGN.md` (tables) and `packages/shared/src/tokens.css` (implementation). Inviolable: color communicates exactly one thing (`--cyan` happening-now, `--green/--amber/--red` fixed state, `--primary` click-this). Data is always DM Mono. No off-scale spacing. Status classes identical across popup, dashboard, admin.

## 6. Schema & auth (implemented in migrations 0001–0004 + seed)
- Tables: profiles (plan free/founder/agency, Paystack fields), **products** (the ICP has a portfolio; everything hangs off products), platforms (categories ai/startup/saas/dev — **no web2, no proxy fields**; editorial_score seed + computed quality_score), campaigns (per product), submissions (status includes `awaiting_email_verification`), distribution_scores (append-only), edits_telemetry, feature_flags, resubmission_queue, notifications, cron_logs, visibility_queries, visibility_checks (append-only, verbatim snippets), adapter_runs (admin-only), admin_audit_log (append-only, never edited from UI).
- RLS on every table except platforms (public read). Verify with a cross-user read: zero rows.
- Auth: Supabase magic link + Google OAuth, one flow. `/auth/callback` **always** ensures a profiles row on first sign-in.
- Emails: **Resend API** (`lib/email/resend.ts`) for digests and notifications.

## 7. Extension (apps/extension)
Plasmo MV3. Permissions: activeTab, scripting, tabs, storage, alarms — nothing more. `externally_connectable`: beta.usersessions.io + localhost:3000. Background: MV3-safe campaign loop (state persisted, survives worker restarts), rate limiting + jitter, CAPTCHA relay, human-in-the-loop for account creation and email verification. Content script extracts site data. Gemini generates platform-category copy; approval UI shows every word. Adapters emit `PlatformResult` (shared type), append UTM (`utm_source=usersessions&utm_medium=distribution&utm_campaign={campaignId}`) pre-submission, support `simulated` mode. Calls `POST /api/campaigns/preflight` before launch; surfaces `PLAN_LIMIT_EXCEEDED` as a specific UI state.

## 8. Dashboard (apps/dashboard)
- Overview `/`: Realtime refresh (zero polling), Install → Launch → Watch indicator, Distribution Score + AI Visibility Score serif-metric cards, 90-day TrendChart, notifications, recent activity, product switcher.
- `/campaigns`: inline row expansion, per-platform results, report links.
- `/listings`: all submissions; filters; Platform Quality badges; Resubmit on dead rows; "Confirm via email" prompts on awaiting rows. (Never named "backlinks".)
- `/platforms`: quality-sorted grid; editorial estimates labeled until computed; locked tiers visible at reduced opacity, never hidden.
- `/analytics`: score trends, link-survival curve (7/30/60/90-day cohorts), per-user platform ranking.
- `/reports/[campaignId]`: public, 404 if invalid, print-optimized (print-to-PDF IS the PDF), agency branding plumbing.
- TrendChart: one shared SVG component; <2 points renders honest flat placeholder.

## 9. Monitoring engine (the recurring value)
- Link-check cron 03:00 UTC: GET fallback, retry with backoff, **48h grace before `removed`** (false dead-link alerts are trust-fatal), then notification + score recompute. Indexation checks promote to `indexed`.
- Auto-resubmission is paid-tier; free users resubmit manually.
- New-platform drops: notification + one-click submit-to-new-platforms.
- Weekly digest email via Resend.
- GA4/GSC OAuth attribution: **deferred**. UTM append + "view referrals in your own GA" docs instead. Returns post-validation with confidence bands on every number.

## 10. Measurement moat
- Platform Quality Score: nightly cron, aggregated across ALL users (survival + indexation + editorial), stored on platforms.quality_score.
- AI Visibility: 3–5 AI-suggested user-editable queries per product; weekly cron across chatgpt/perplexity/gemini; verbatim snippets stored and shown as-is; a "not mentioned" week is displayed, never smoothed; score 0–100 append-only.
- Competitor Distribution Scan: public; top-line free, full gap list behind signup. CTA: "Get your product found".
- Brand-fit preflight: strict confidence threshold; zero warnings is correct behavior.

## 11. Monetization — Paystack, subscription-only
| | Free | Founder $39/mo ($390/yr) | Agency $199/mo |
|---|---|---|---|
| Products | 1 | 3 | 15 client workspaces |
| Launches | 3 free-tier submissions total | 2 full launches/product/mo | Pooled, priority |
| Monitoring | View-only | Full (auto-resubmit, digest, drops) | Full |
| AI Visibility | 1 query, monthly | 5/product, weekly | 10/product, weekly |
| Reports | — | Standard | White-label |

- Flags fail closed; `/pricing` is a real 404 while off.
- Checkout: Paystack Initialize Transaction with Plan codes. Webhook: verify `x-paystack-signature` (HMAC-SHA512); handle charge.success, subscription.create, subscription.disable, invoice.payment_failed; store `email_token` for cancellation. Confirm settlement currency approval before building checkout.
- Metering in `POST /api/campaigns` (slots, launches/mo, platform tiers) → `PLAN_LIMIT_EXCEEDED`.
- **Advertising permanently removed.** Sponsored placements deferred indefinitely.

## 12. Admin
Server-side role check + hard redirect on every `/admin/*` route (never CSS-hidden). Surfaces: system (cron_logs, queue depths), users (suspend, time-limited bannered impersonation), flags, billing overrides, adapter review queue (canary results, Approve→Stage 10%/Reject), data-quality (edits_telemetry browser). **Every admin mutation writes to admin_audit_log. Append-only.**

## 13. Homepage (last, after real data exists)
StoryBrand section 2, exactly. One CTA verbatim ×3. Transitional CTAs: competitor scan + real dogfood report. Real screenshots only. Zero fabricated numbers. Naming checkpoint: confirm or replace "usersessions.io" before the brand locks.

## 14. Cross-app contract rules
`packages/shared` is the ONLY home for contract types (PlatformResult, TelemetryBatch, status enums, plan ids, bridge messages) and design tokens. Cross-cutting features ship as one MR touching both apps + shared. Vercel builds apps/dashboard only (root dir setting); extension ships via `extension-v*` tags. Supabase migrations live in apps/dashboard/supabase/migrations.

## 15. Risk register (re-check at every milestone boundary)
| Risk | Mitigation |
|---|---|
| Listings without users (outcome gap) | AI Visibility makes the outcome visible; wedge targets AI-cited platforms; dogfood proof required |
| One-time-job churn | Monitoring loop + product slots + platform drops; no one-time SKU exists |
| Adapter treadmill | 15-platform wedge; canary-gated fixes; no aspirational rows |
| Chrome Web Store rejection | Human-in-the-loop, minimal permissions, no account creation, dashboard valuable standalone |
| False dead-link alerts | 48h grace, GET fallback, backoff |
| Trust collapse | Zero fabricated numbers; labeled estimates; verbatim snippets; append-only scores |
| Spam-tool perception | No web2/proxies/farmed accounts; rate-limited; "Listings" not "backlinks" |
