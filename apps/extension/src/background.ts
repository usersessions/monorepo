import type { BridgeMessage, PlatformResult, SiteData } from '@usersessions/shared'

/**
 * Background service worker — MV3-SAFE BY CONSTRUCTION:
 * all campaign state lives in chrome.storage.local, never in worker memory,
 * so pause/resume and in-flight campaigns survive worker restarts (BUILD_SPEC §7).
 */

// ---------- Auth token bridge (dashboard ExtensionBridge → here) ----------
chrome.runtime.onMessageExternal.addListener(
  (message: BridgeMessage, _sender, sendResponse) => {
    if (message?.type === 'SET_TOKEN' && typeof message.token === 'string') {
      void chrome.storage.local.set({ accessToken: message.token }).then(() => sendResponse({ ok: true }))
      return true // async response
    }
    return false
  }
)

// ---------- Campaign state machine ----------
export interface CampaignRunState {
  status: 'idle' | 'running' | 'paused' | 'awaiting_captcha'
  campaignId?: string
  productId?: string
  queue: string[] // platform ids remaining
  results: PlatformResult[]
  simulated: boolean
}

const STATE_KEY = 'campaignState'
const IDLE: CampaignRunState = { status: 'idle', queue: [], results: [], simulated: true }

async function getState(): Promise<CampaignRunState> {
  const stored = await chrome.storage.local.get(STATE_KEY)
  return (stored[STATE_KEY] as CampaignRunState) ?? IDLE
}

async function setState(state: CampaignRunState): Promise<void> {
  await chrome.storage.local.set({ [STATE_KEY]: state })
}

// Human-mimicking pacing: base interval + jitter. We are not a spam tool (BUILD_SPEC §1).
const RATE_LIMIT_MIN_MS = 45_000
const JITTER_MAX_MS = 30_000
export const nextDelayMs = (): number => RATE_LIMIT_MIN_MS + Math.floor(Math.random() * JITTER_MAX_MS)

// ---------- Popup ↔ background messaging ----------
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  void (async () => {
    switch (msg?.type) {
      case 'GET_STATE': {
        const { accessToken } = await chrome.storage.local.get('accessToken')
        sendResponse({ state: await getState(), connected: Boolean(accessToken) })
        break
      }

      case 'PAUSE': {
        const s = await getState()
        if (s.status === 'running') {
          s.status = 'paused'
          await setState(s)
        }
        sendResponse({ state: await getState() })
        break
      }

      case 'RESUME': {
        const s = await getState()
        if (s.status === 'paused') {
          s.status = 'running'
          await setState(s)
        }
        sendResponse({ state: await getState() })
        break
      }

      case 'EXTRACT_ACTIVE_TAB': {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
        if (!tab?.id) {
          sendResponse({ ok: false, error: 'No active tab.' })
          break
        }
        try {
          const data = (await chrome.tabs.sendMessage(tab.id, { type: 'EXTRACT_SITE_DATA' })) as SiteData
          await chrome.storage.local.set({ siteData: data })
          sendResponse({ ok: true, data })
        } catch {
          sendResponse({
            ok: false,
            error: 'Could not read this page — reload it and try again.',
          })
        }
        break
      }

      // CAPTCHA relay: adapters (M6) report CAPTCHA_DETECTED from submission tabs; the human
      // solves it (assisted automation — BUILD_SPEC §1); adapters resume on CAPTCHA_SOLVED.
      case 'CAPTCHA_DETECTED': {
        const s = await getState()
        if (s.status === 'running') {
          s.status = 'awaiting_captcha'
          await setState(s)
        }
        sendResponse({ ok: true })
        break
      }

      default:
        sendResponse({ ok: false, error: 'Unknown message type.' })
    }
  })()
  return true // keep channel open for async responses
})

// M5: Gemini copy generation (brain.ts) — EXECUTION_PLAN M5.
// M6: adapter registry + campaign execution loop (3 pilots, then 15) — EXECUTION_PLAN M6.
// M7: POST results to /api/campaigns with the stored Bearer token — EXECUTION_PLAN M7.
export {}
