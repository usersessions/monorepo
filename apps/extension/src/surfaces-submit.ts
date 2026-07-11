import type { SiteData } from '@usersessions/shared'

/**
 * Records an assisted-manual surface submission via the existing campaigns heartbeat.
 * A surface submission is a real, human-posted distribution the monitoring loop will
 * verify; we reuse POST /api/campaigns with the surface id carried in platformId as
 * `surface:<id>` so no schema divergence is required on the ingest path.
 */

const DASHBOARD_URL = process.env.PLASMO_PUBLIC_DASHBOARD_URL ?? 'https://usersessions.io'

export async function postSurfaceSubmission(input: {
  surfaceId: string
  campaignId: string
}): Promise<{ ok: boolean }> {
  const { accessToken, siteData, productIdByUrl } = await chrome.storage.local.get([
    'accessToken',
    'siteData',
    'productIdByUrl',
  ])
  if (!accessToken) return { ok: false }
  const site = siteData as SiteData | undefined
  if (!site?.url) return { ok: false }

  const ids = (productIdByUrl as Record<string, string> | undefined) ?? {}
  const productId = ids[site.url]
  if (!productId) return { ok: false } // a directory launch bootstraps the product first

  try {
    const res = await fetch(`${DASHBOARD_URL}/api/campaigns`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        campaignId: input.campaignId,
        productId,
        productName: site.title,
        productUrl: site.url,
        startedAt: new Date().toISOString(),
        finishedAt: new Date().toISOString(),
        results: [{ platformId: `surface:${input.surfaceId}`, status: 'submitted', simulated: false }],
      }),
    })
    return { ok: res.ok }
  } catch {
    return { ok: false }
  }
}
