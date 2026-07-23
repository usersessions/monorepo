#!/usr/bin/env node
/**
 * Adds `export const dynamic = 'force-dynamic'` after the last import line
 * in every API route that uses Supabase but doesn't already have it.
 */
const fs = require('fs')
const path = require('path')

const routes = [
  'apps/dashboard/app/api/admin/platforms/health/route.ts',
  'apps/dashboard/app/api/admin/profitability/route.ts',
  'apps/dashboard/app/api/admin/search/route.ts',
  'apps/dashboard/app/api/admin/alerts/route.ts',
  'apps/dashboard/app/api/admin/export/route.ts',
  'apps/dashboard/app/api/user/usage/route.ts',
  'apps/dashboard/app/api/scrape/preview/route.ts',
  'apps/dashboard/app/api/push/subscribe/route.ts',
  'apps/dashboard/app/api/videos/route.ts',
  'apps/dashboard/app/api/videos/generate/route.ts',
  'apps/dashboard/app/api/videos/[id]/caption/route.ts',
  'apps/dashboard/app/api/videos/[id]/regenerate/route.ts',
  'apps/dashboard/app/api/videos/[id]/route.ts',
  'apps/dashboard/app/api/videos/[id]/poll/route.ts',
  'apps/dashboard/app/api/profile/route.ts',
  'apps/dashboard/app/api/ai/prompt/route.ts',
  'apps/dashboard/app/api/account/delete/route.ts',
  'apps/dashboard/app/api/account/export/route.ts',
  'apps/dashboard/app/api/webhooks/minimax/[id]/route.ts',
  'apps/dashboard/app/api/webhooks/paystack/route.ts',
  'apps/dashboard/app/api/webhooks/resend/route.ts',
  'apps/dashboard/app/api/billing/cancel/route.ts',
  'apps/dashboard/app/api/billing/checkout/route.ts',
]

const EXPORT_LINE = `\n// Force dynamic: Supabase URL is a runtime env var on Cloudflare, not a build var.\nexport const dynamic = 'force-dynamic'\n`

let fixed = 0
for (const rel of routes) {
  const filePath = path.resolve(rel)
  if (!fs.existsSync(filePath)) {
    console.warn(`  SKIP (not found): ${rel}`)
    continue
  }

  let content = fs.readFileSync(filePath, 'utf8')

  // Skip if already present
  if (content.includes("export const dynamic")) {
    console.log(`  SKIP (already has it): ${rel}`)
    continue
  }

  // Find the index of the last import statement
  const lines = content.split('\n')
  let lastImportIdx = -1
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith('import ')) lastImportIdx = i
  }

  if (lastImportIdx === -1) {
    console.warn(`  SKIP (no imports found): ${rel}`)
    continue
  }

  // Insert after the last import line
  lines.splice(lastImportIdx + 1, 0, EXPORT_LINE)
  fs.writeFileSync(filePath, lines.join('\n'), 'utf8')
  console.log(`  FIXED: ${rel}`)
  fixed++
}

console.log(`\nDone. Fixed ${fixed} files.`)
