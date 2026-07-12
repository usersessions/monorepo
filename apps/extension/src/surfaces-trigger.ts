/**
 * Shared surface-distribution trigger used by BOTH the popup 'DISTRIBUTE_SURFACE' handler and
 * the dashboard 'TRIGGER_SURFACE' external message. Opens the surface, drafts assisted copy,
 * and injects the editable sidebar. Nothing is auto-submitted — the human posts it themselves.
 */
import type { SiteData } from '@usersessions/shared'
import { fetchSurfaces, fetchSurfaceCopy } from './surfaces'

export async function distributeToSurface(surfaceId: string): Promise<{ ok: boolean; error?: string }> {
  if (!surfaceId) return { ok: false, error: 'INVALID_SURFACE' }
  const { siteData } = await chrome.storage.local.get('siteData')
  const site = siteData as SiteData | undefined
  if (!site?.title) return { ok: false, error: 'Analyze your product page first.' }

  const entries = await fetchSurfaces()
  const entry = entries?.find((e) => e.surface.id === surfaceId)
  if (!entry) return { ok: false, error: 'UNKNOWN_SURFACE' }
  if (!entry.unlocked) return { ok: false, error: 'TIER_LOCKED' }

  const copyRes = await fetchSurfaceCopy({
    surfaceId,
    title: site.title,
    url: site.url,
    description: site.description ?? '',
  })
  if (!copyRes.ok) return { ok: false, error: copyRes.error }

  const openUrl = entry.surface.urlPattern || site.url
  const tab = await chrome.tabs.create({ url: openUrl, active: true })
  await new Promise<void>((resolve) => {
    const listener = (id: number, info: chrome.tabs.TabChangeInfo) => {
      if (id === tab.id && info.status === 'complete') {
        chrome.tabs.onUpdated.removeListener(listener)
        resolve()
      }
    }
    chrome.tabs.onUpdated.addListener(listener)
    setTimeout(() => {
      chrome.tabs.onUpdated.removeListener(listener)
      resolve()
    }, 15_000)
  })
  await chrome.storage.local.set({
    [`surfaceTab:${tab.id}`]: { surfaceId, campaignId: crypto.randomUUID() },
  })
  try {
    await chrome.tabs.sendMessage(tab.id!, {
      type: 'RENDER_SURFACE_PANEL',
      data: { surfaceId, surfaceName: entry.surface.name, copy: copyRes.copy },
    })
  } catch {
    /* sidebar injection is best-effort; the tab is still open for the user */
  }
  return { ok: true }
}
