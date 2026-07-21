import type { PlasmoCSConfig } from 'plasmo'

export const config: PlasmoCSConfig = {
  matches: ['<all_urls>'],
}

/** Simplified extractor — basic page metadata only (campaign extraction removed in the video pivot). */
function meta(key: string): string | null {
  const el = document.querySelector(`meta[property="${key}"]`) ?? document.querySelector(`meta[name="${key}"]`)
  return el?.getAttribute('content') ?? null
}

chrome.runtime.onMessage.addListener((message: { type?: string }, _sender, sendResponse) => {
  if (message?.type !== 'EXTRACT_SITE_DATA') return false
  sendResponse({
    url: location.href,
    title: meta('og:title') ?? document.title,
    description: meta('og:description') ?? meta('description'),
    image: meta('og:image'),
    siteName: meta('og:site_name'),
  })
  return true
})
