# usersessions.io — Feature Map (Updated Post-Pivot)

> **What it is:** usersessions.io turns a Shopify/Etsy/Amazon product URL into a polished 6-10 second video ad (TikTok, Reels, Shorts), with an AI-generated social caption ready to post.
>
> **Core loop:** Paste URL → Scrape → Generate Prompt → Generate Video → Caption → Post

---

## ✅ Phase 0 — Foundation & Infrastructure

### Database Schema (18 migrations applied)
| Migration | What it built |
|-----------|---------------|
| `0001_core` | `profiles`, `products`, `platforms`, `campaigns`, `submissions`, `distribution_scores`, `feature_flags` |
| `0002_monitoring` | `resubmission_queue`, `cron_logs`, `notifications` |
| `0003_measurement` | `visibility_queries`, `visibility_checks` |
| `0004_admin` | `adapter_runs`, `admin_audit_log` |
| `0006_activate_features` | Feature flag seeding |
| `0007_admin_user` | Admin user bootstrap |
| `0009_realtime` | Supabase realtime publications |
| `0010_notification_prefs` | Notification preferences |
| `0012_integrations` | Integration tracking |
| `0013_performance_indexes` | DB performance indexes |
| `0014_admin_expansion` | Extended admin tables |
| `0015_activate_billing` | Billing tables + Paystack fields on `profiles` |
| `0019_sandbox_activation` | Simulation mode |
| `0022_email_events` | Resend webhook event log |
| `0034_feature_events` | Feature usage tracking |
| `0037_video_billing_system` | `videos` table, billing credits for video generation |
| `0038_drop_legacy_tables` | Drops old unused tables from pre-pivot |

> ⚠️ Migrations 0005, 0008, 0011, 0017-0018, 0020-0021, 0023-0033, 0035-0036 belonged to the old
> submission-engine product and are no longer needed — their code has been deleted.

### Auth & Identity ✅
- Supabase magic link + Google OAuth
- `/auth/callback` creates `profiles` row on first sign-in
- Middleware route protection on all `/dashboard/*` routes

### Design System ✅
- CSS token system in `packages/shared/src/tokens.css`
- Tailwind extended with shadcn/ui CSS variable mappings (`border`, `muted`, `card`, `primary`, etc.)
- Typography: DM Mono for data, serif for metrics

---

## ✅ Phase 1 — Video Generation Engine

### URL Scraper ✅
- `services/scraper.ts` — scrapes Shopify / Etsy / Amazon / any product URL
- `POST /api/scrape/preview` — returns title, description, images for preview

### AI Prompt Engineering ✅ (`services/gemini.ts`)
- `generateVideoPrompt(title, description)` — bakes 10-second rule, product-as-hero, no text/captions
- 6 unbreakable prompt rules enforced
- Category strategies: Beauty, Food/Beverage, Fashion, Electronics, Home/Décor + generic fallback
- Hailuo-tuned vocabulary (dolly-in, orbit, macro, rack focus, lighting moods)
- Anti-patterns blocked: on-screen text, fast cuts, crowds
- `generateCaption(title, prompt)` — Anti-AI writing guardrails for TikTok/Reels captions

### Video Generation ✅ (`services/minimax.ts`)
- Direct MiniMax Hailuo-2.3-Fast API — $0.33/video vs $0.40-0.50 via middleman
- Model configurable via `VIDEO_MODEL` env var
- `POST /api/videos` — creates video row + submits to MiniMax
- `POST /api/videos/generate` — alternate generation endpoint
- `GET /api/videos` — lists all user videos
- `GET /api/videos/[id]` — single video detail
- `POST /api/videos/[id]/regenerate` — retry failed videos
- `POST /api/videos/[id]/caption` — generate social caption for a ready video

### Video Status Flow ✅
`queued` → `generating` → `ready` | `failed`

### Notification on Completion ✅
- `NotificationToaster` — in-app toast when video reaches `ready` status

---

## ✅ Phase 2 — Dashboard Pages

| Page | Status | Notes |
|------|--------|-------|
| `/` (home) | ✅ | Marketing homepage |
| `/generate` | ✅ | Main UI — paste URL, scrape, generate video |
| `/videos` | ✅ | Video library grid |
| `/videos/[id]` | ✅ | Player + prompt + Auto-Generate Caption |
| `/analytics` | ✅ | Usage analytics |
| `/notifications` | ✅ | Notification feed |
| `/onboarding` | ✅ | New user onboarding |
| `/products` | ✅ | Product management |
| `/settings` | ✅ | Profile, billing, notification prefs |
| `/settings/cancel` | ✅ | Cancel subscription (CA ARL compliant) |
| `/settings/integrations` | ✅ | Integration management |
| `/pricing` | ✅ | 3-tier self-serve + Agency "Contact Us" |

---

## ✅ Phase 3 — Billing (Paystack)

### Plans
| Plan | Price | Videos/Month | Margin |
|------|-------|-------------|--------|
| Free | $0 | 3 | Loss leader |
| Starter | $19/mo | 15 | ~72% |
| Pro | $49/mo | 50 | ~64% |
| Agency | Contact Us | 200 | ~53% |

**COGS per video:** ~$0.37 (Gemini $0.015 + MiniMax $0.33 + storage/bandwidth $0.025)
**Overage:** $2.00/video (5× COGS — pushes upgrades)

### Billing Infrastructure ✅
- `POST /api/billing/checkout` — Paystack authorization URL
- `POST /api/billing/cancel` — subscription cancellation
- `POST /api/billing/webhook` — HMAC-SHA512 verified Paystack events
- `lib/tiers.ts` — single source for all plan limits + helpers: `getPlanConfig`, `limitsFor`, `canGenerateVideo`, `analyzePlanProfitability`
- `services/credits.ts` — video credit metering

---

## ✅ Phase 4 — Admin Panel

| Page | Status |
|------|--------|
| `/admin` | ✅ System overview |
| `/admin/users` | ✅ User management |
| `/admin/users/[userId]` | ✅ Per-user detail |
| `/admin/flags` | ✅ Feature flags |
| `/admin/billing` | ✅ Billing overrides |
| `/admin/adapters` | ✅ Adapter management |
| `/admin/data-quality` | ✅ Telemetry browser |
| `/admin/usage` | ✅ 7-day usage metrics, dead-feature detection |
| `/admin/platform-requests` | ✅ Platform requests queue |
| `/admin/audit` | ✅ Admin audit log |
| `/admin/compliance` | ✅ Compliance overview |
| `/admin/dogfood` | ✅ Internal testing |
| `/admin/settings` | ✅ Config + email test |
| `/admin/support` | ✅ Support queue |
| `/admin/profitability` | ✅ Per-plan margin analysis |

---

## ✅ Phase 5 — Public Pages & SEO

| Page | Status |
|------|--------|
| `/home` | ✅ Marketing homepage |
| `/pricing` | ✅ |
| `/articles/[slug]` | ✅ Blog |
| `/faq` | ✅ + JSON-LD |
| `/privacy` | ✅ |
| `/terms` | ✅ |
| `/support` | ✅ + Agency inquiry |
| `manifest.ts` | ✅ PWA |
| `sitemap.ts` | ✅ |
| `robots.ts` | ✅ |

---

## ✅ Phase 6 — Infrastructure

### Email (Resend) ✅
- `POST /api/webhooks/resend` — HMAC-SHA256 verified event log
- Transactional: welcome, payment received, payment failed

### Push Notifications ✅
- `POST /api/push/subscribe` + `PushToggle` + `sw.js` service worker

### Account ✅
- `POST /api/account/delete`, `GET /api/account/export`
- `GET /api/profile`, `GET /api/user/usage`

---

## ❌ Removed (Pre-Pivot — All Code Deleted)

- **Chrome Extension** (`apps/extension/`) — entire Plasmo MV3 app
- **ExtensionBridge, ExtensionStatus** — dashboard bridge components
- **All pre-pivot features:** Campaigns, Listings, Platforms, Reports, Competitors, Reviews, Content Generator, Surfaces, Communities, Referrals, Founder Audit, Landing Page Audit
- **`services/fal.ts`** — replaced by `services/minimax.ts`
- **`api/webhooks/fal/`** — replaced by MiniMax direct polling
- **`api/content`, `api/events`, `api/health`, `api/cron/weekly-digest`** — deleted
- **`TrackView.tsx`, `UsageTrendChart.tsx`, `lib/tracking.ts`, `RealtimeRefresh.tsx`** — deleted
- **Weekly digest cron** — deleted (no longer relevant)

---

## 🔜 Not Yet Built (Prioritized)

| Feature | Priority | Notes |
|---------|----------|-------|
| MiniMax status polling / webhook | 🔴 HIGH | Videos stay `generating` forever — need a poll loop or webhook handler to flip status to `ready` |
| Video thumbnail generation | 🟡 MEDIUM | Extract first frame as poster image |
| Caption copy-to-clipboard | 🟡 MEDIUM | One-tap copy after caption is generated |
| Usage meter on dashboard home | 🟡 MEDIUM | Show videos used / plan limit prominently |
| Bulk video generation | 🟡 MEDIUM | Generate multiple variants from one URL |
| Watermark on Free tier | 🟢 LOW | Enforce watermark overlay on Free plan exports |
| Social scheduling / direct post | 🟢 LOW | TikTok / Instagram API direct posting |

---

## 🛡️ Security

- All API routes: `supabase.auth.getUser()` before any data access
- Row-level security: cross-user reads return zero rows
- Admin routes: server-side role check, never CSS-hidden
- Billing webhooks: HMAC signature verified before processing
- Caption API: video ownership verified (video.user_id === user.id)

---

## 📊 Current Numbers

- **18** database migrations (applied)
- **24** API route groups
- **12** dashboard pages
- **4** plan tiers
- **3** AI-powered services (prompt, caption, video)
- **1** video provider (MiniMax Hailuo-2.3-Fast @ $0.33/video)
