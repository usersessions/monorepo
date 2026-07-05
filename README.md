# usersessions.io — monorepo

**Get your product found.** A distribution engine for founders: a Chrome extension submits your product across the platforms humans and AI assistants discover software from, and a dashboard verifies every listing and tracks whether AI actually recommends you.

## Structure

```
apps/dashboard    Next.js 15 App Router — deploys to Vercel (root dir: apps/dashboard) at beta.usersessions.io
apps/extension    Plasmo MV3 Chrome extension — store zip built on extension-v* tags
packages/shared   THE ONLY home for cross-app contracts (types, enums) and design tokens
```

## Governing documents (read in this order)

1. `BUILD_SPEC.md` — what we are building. Source of truth.
2. `DESIGN.md` — design tokens. No visual value exists outside these tables.
3. `EXECUTION_PLAN.md` — build order, milestone gates. Execute strictly in sequence.

## Quickstart

```bash
corepack enable
pnpm install
cp apps/dashboard/.env.example apps/dashboard/.env.local   # fill in keys
pnpm --filter dashboard dev      # http://localhost:3000
pnpm --filter extension dev      # load build/chrome-mv3-dev unpacked
```

Database: apply `apps/dashboard/supabase/migrations/*.sql` in order to your Supabase project, then `supabase/seed.sql`.
