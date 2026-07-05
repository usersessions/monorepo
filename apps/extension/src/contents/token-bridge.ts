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
 * Token bridge content script: receives the Supabase access token the dashboard posts via
 * window.postMessage (ExtensionBridge) and forwards it to the background worker over
 * INTERNAL messaging — no extension ID required, so sign-in connects for packed,
 * unpacked and dev installs alike. Matches every domain the dashboard deploys to
 * (apex, www, beta, Vercel previews, localhost): the #1 cause of "not connected"
 * is the dashboard running on a domain this script does not inject into.
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
  void chrome.runtime.sendMessage({ type: 'SET_TOKEN', token: data.token })
})
