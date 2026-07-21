/**
 * Minimal MV3 service worker — PIVOT: campaign loop removed.
 * Keeps only the dashboard token bridge and a screenshot capture handler
 * used by the new product→video capture flow.
 */
export {}

chrome.runtime.onMessage.addListener((message: { type?: string; token?: string }, _sender, sendResponse) => {
  if (message?.type === 'SET_TOKEN' && typeof message.token === 'string') {
    chrome.storage.local.set({ accessToken: message.token }).then(() => sendResponse({ ok: true }))
    return true
  }
  if (message?.type === 'GET_TOKEN') {
    chrome.storage.local.get('accessToken').then((v) => sendResponse({ token: (v.accessToken as string | undefined) ?? null }))
    return true
  }
  if (message?.type === 'CAPTURE_SCREENSHOT') {
    chrome.tabs
      .captureVisibleTab({ format: 'png' })
      .then((dataUrl) => sendResponse({ ok: true, dataUrl }))
      .catch((e) => sendResponse({ ok: false, error: String(e) }))
    return true
  }
  return false
})
