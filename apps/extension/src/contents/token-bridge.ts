import type { PlasmoCSConfig } from 'plasmo'

export const config: PlasmoCSConfig = {
  matches: [
    'https://usersessions.io/*',
    'https://www.usersessions.io/*',
    'https://beta.usersessions.io/*',
    'https://*.vercel.app/*',
    'http://localhost:3000/*',
  ],
}

/**
 * Token bridge content script — TWO-WAY HANDSHAKE.
 * The dashboard may post the token BEFORE this script injects (document_idle),
 * so a one-shot listener loses the message. Protocol:
 *   1. On injection, announce BRIDGE_READY → the dashboard re-posts the token.
 *   2. On SET_TOKEN, store via the background worker, then ack TOKEN_RECEIVED
 *      so the dashboard stops its retry loop.
 * No extension ID required — works for packed, unpacked and dev installs.
 */
window.addEventListener('message', (event) => {
  if (event.source !== window || event.origin !== window.location.origin) return
  const data = event.data as { source?: string; type?: string; token?: string } | undefined
  if (
    data?.source !== 'usersessions-dashboard' ||
    data.type !== 'SET_TOKEN' ||
    typeof data.token !== 'string'
  )
    return

  Promise.resolve(chrome.runtime.sendMessage({ type: 'SET_TOKEN', token: data.token }))
    .then(() => {
      window.postMessage(
        { source: 'usersessions-extension', type: 'TOKEN_RECEIVED' },
        window.location.origin
      )
    })
    .catch(() => {
      // Background worker asleep or reloading — the dashboard retry loop covers this.
    })
})

// Announce readiness: covers the case where the dashboard posted before we injected.
window.postMessage({ source: 'usersessions-extension', type: 'BRIDGE_READY' }, window.location.origin)
