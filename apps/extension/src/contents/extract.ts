import type { PlasmoCSConfig } from 'plasmo'
import type { SiteData } from '@usersessions/shared'

export const config: PlasmoCSConfig = {
  matches: ['<all_urls>'],
}

function metaContent(selector: string): string {
  return document.querySelector(selector)?.getAttribute('content')?.trim() ?? ''
}

/**
 * Reads the founder's own landing page so they never re-type what their product is
 * (BUILD_SPEC §7). Extraction only — this script never modifies any page.
 */
function extractSiteData(): SiteData {
  const h1s = Array.from(document.querySelectorAll('h1'))
    .map((h) => h.textContent?.trim() ?? '')
    .filter(Boolean)

  const keywords = metaContent('meta[name="keywords"]')
    .split(',')
    .map((k) => k.trim())
    .filter(Boolean)

  return {
    url: window.location.href,
    title: document.title || metaContent('meta[property="og:title"]'),
    description: metaContent('meta[name="description"]') || metaContent('meta[property="og:description"]'),
    tagline: h1s[0],
    keywords,
    h1s,
  }
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type === 'EXTRACT_SITE_DATA') {
    sendResponse(extractSiteData())
  }
})
