import { appendUtm } from '@usersessions/shared'
import type { BridgeMessage, GeneratedCopy, PlatformResult, SiteData } from '@usersessions/shared'

import { postCampaign } from './api'
import { ADAPTERS, getAdapter } from './adapters/registry'
import type { AdapterOutcome, RunContext } from './adapters/types'

/**
 * Background service worker — MV3-SAFE BY CONSTRUCTION:
 * all campaign state lives in chrome.storage.local and step delays use chrome.alarms,
 * so pause/resume and in-flight campaigns survive worker restarts (BUILD_SPEC §7).
 */

// ---------- Auth token bridge (dashboard ExtensionBridge → here) ----------
chrome.runtime.onMessageExternal.addListener(
  (message: BridgeMessage, _sender, sendResponse) => {
    if (message?.type === 'SET_TOKEN' && typeof message.token === 'string') {
      void chrome.storage.local.set({ accessToken: message.token }).then(() => {
        void retrySync() // a fresh token may unblock a run stuck in sync_error
        sendResponse({ ok: true })
      })
      return true
    }
    return false
  }
)

// ---------- Campaign state ----------
export interface CampaignRunState {
  status: 'idle' | 'running' | 'paused' | 'awaiting_captcha' | 'done' | 'plan_limit' | 'sync_error'
  campaignId?: string
  productId?: string
  startedAt?: string
  simulated: boolean
  queue: string[]
  currentPlatform?: string
  results: PlatformResult[]
}

const STATE_KEY = 'campaignState'
const ALARM_NEXT = 'campaign-next'
const ALARM_SYNC = 'campaign-sync-retry'
const IDLE: CampaignRunState = { status: 'idle', simulated: true, queue: [], results: [] }

async function getState(): Promise<CampaignRunState> {
  const stored = await chrome.storage.local.get(STATE_KEY)
  return (stored[STATE_KEY] as CampaignRunState) ?? IDLE
}
async function setState(state: CampaignRunState): Promise<void> {
  await chrome.storage.local.set({ [STATE_KEY]: state })
}

// Human-mimicking pacing (BUILD_SPEC §1: not a spam tool). Simulation paces lightly.
const RATE_LIMIT_MIN_MS = 45_000
const JITTER_MAX_MS = 30_000
const nextDelayMs = (simulated: boolean): number =>
  simulated ? 2_000 : RATE_LIMIT_MIN_MS + Math.floor(Math.random() * JITTER_MAX_MS)

// ---------- Campaign loop ----------
async function startCampaign(requestedSimulated: boolean): Promise<CampaignRunState> {
  const { siteData, approvedCopy, productIdByUrl } = await chrome.storage.local.get([
    'siteData',
    'approvedCopy',
    'productIdByUrl',
  ])
  const site = siteData as SiteData | undefined
  const copy = (approvedCopy as GeneratedCopy[] | undefined) ?? []
  if (!site || copy.length === 0) {
    return { ...IDLE, status: 'idle' } // popup guards this; defensive here
  }

  // M6 GATE ENFORCED: live mode is refused until every queued adapter is verified.
  const allVerified = ADAPTERS.every((a) => a.verified)
  const simulated = requestedSimulated || !allVerified

  // Stable product id per landing-page URL.
  const ids = (productIdByUrl as Record<string, string> | undefined) ?? {}
  if (!ids[site.url]) {
    ids[site.url] = crypto.randomUUID()
    await chrome.storage.local.set({ productIdByUrl: ids })
  }

  const state: CampaignRunState = {
    status: 'running',
    campaignId: crypto.randomUUID(),
    productId: ids[site.url],
    startedAt: new Date().toISOString(),
    simulated,
    queue: ADAPTERS.map((a) => a.platformId),
    results: [],
  }
  await setState(state)
  chrome.alarms.create(ALARM_NEXT, { when: Date.now() + 500 })
  return state
}

function waitForTabLoad(tabId: number): Promise<void> {
  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      chrome.tabs.onUpdated.removeListener(listener)
      resolve()
    }, 20_000)
    const listener = (id: number, info: chrome.tabs.TabChangeInfo) => {
      if (id === tabId && info.status === 'complete') {
        clearTimeout(timeout)
        chrome.tabs.onUpdated.removeListener(listener)
        resolve()
      }
    }
    chrome.tabs.onUpdated.addListener(listener)
  })
}

function toResult(platformId: string, outcome: AdapterOutcome, simulated: boolean): PlatformResult {
  switch (outcome.outcome) {
    case 'filled':
    case 'submitted':
      return { platformId, status: 'submitted', simulated }
    case 'captcha':
      return { platformId, status: 'failed', simulated, error: 'CAPTCHA — needs a human, rerun with the tab open' }
    case 'failed':
      return { platformId, status: 'failed', simulated, error: outcome.error }
  }
}

/**
 * Posts the finished run to the dashboard. A failed sync NEVER drops results:
 * the run enters 'sync_error', keeps everything in storage, and retries on an
 * alarm, on demand (RETRY_SYNC), and whenever a fresh token arrives.
 */
async function syncCampaign(state: CampaignRunState): Promise<void> {
  const { siteData } = await chrome.storage.local.get('siteData')
  const site = siteData as SiteData | undefined
  const res = await postCampaign({
    campaignId: state.campaignId!,
    productId: state.productId!,
    productName: site?.title ?? 'Untitled product',
    productUrl: site?.url ?? '',
    startedAt: state.startedAt!,
    finishedAt: new Date().toISOString(),
    results: state.results,
  })
  if (res.ok) {
    state.status = 'done'
  } else if (res.error === 'PLAN_LIMIT_EXCEEDED') {
    state.status = 'plan_limit'
  } else {
    state.status = 'sync_error'
    chrome.alarms.create(ALARM_SYNC, { when: Date.now() + 30_000 })
  }
  state.currentPlatform = undefined
  await setState(state)
}

async function retrySync(): Promise<void> {
  const state = await getState()
  if (state.status === 'sync_error') await syncCampaign(state)
}

async function processNext(): Promise<void> {
  const state = await getState()
  if (state.status !== 'running') return

  // Queue drained → finalize: post to the dashboard (the M7 heartbeat).
  if (state.queue.length === 0) {
    await syncCampaign(state)
    return
  }

  const platformId = state.queue[0]
  state.queue = state.queue.slice(1)
  state.currentPlatform = platformId
  await setState(state)

  const adapter = getAdapter(platformId)
  const { siteData, approvedCopy } = await chrome.storage.local.get(['siteData', 'approvedCopy'])
  const site = siteData as SiteData
  const copy = (approvedCopy as GeneratedCopy[]) ?? []

  let result: PlatformResult
  if (!adapter || !site) {
    result = { platformId, status: 'failed', simulated: state.simulated, error: 'no adapter or site data' }
  } else {
    const categoryCopy = copy.find((c) => c.category === adapter.category) ?? copy[0]
    const context: RunContext = {
      title: site.title,
      url: appendUtm(site.url, state.campaignId!), // UTM on every URL before submission (BUILD_SPEC §7)
      tagline: site.tagline ?? categoryCopy?.hook ?? '',
      hook: categoryCopy?.hook ?? '',
      body: categoryCopy?.body ?? '',
    }
    try {
      const tab = await chrome.tabs.create({ url: adapter.submitUrl, active: true })
      await waitForTabLoad(tab.id!)
      const outcome = (await chrome.tabs.sendMessage(tab.id!, {
        type: 'RUN_ADAPTER',
        steps: adapter.steps,
        context,
        simulated: state.simulated,
      })) as AdapterOutcome
      result = toResult(platformId, outcome, state.simulated)
      if (state.simulated && tab.id) void chrome.tabs.remove(tab.id) // tidy up simulation tabs
    } catch (err) {
      result = { platformId, status: 'failed', simulated: state.simulated, error: String(err) }
    }
  }

  const latest = await getState()
  latest.results = [...latest.results, result]
  latest.currentPlatform = undefined
  await setState(latest)

  if (latest.status === 'running') {
    chrome.alarms.create(ALARM_NEXT, { when: Date.now() + nextDelayMs(latest.simulated) })
  }
}

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === ALARM_NEXT) void processNext()
  if (alarm.name === ALARM_SYNC) void retrySync()
})

// ---------- Popup ↔ background messaging ----------
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  void (async () => {
    switch (msg?.type) {
      case 'SET_TOKEN': {
        // From the token-bridge content script — works without a stable extension ID.
        if (typeof msg.token === 'string') await chrome.storage.local.set({ accessToken: msg.token })
        void retrySync() // a fresh token may unblock a run stuck in sync_error
        sendResponse({ ok: true })
        break
      }
      case 'GET_STATE': {
        const { accessToken } = await chrome.storage.local.get('accessToken')
        sendResponse({ state: await getState(), connected: Boolean(accessToken) })
        break
      }
      case 'START_CAMPAIGN': {
        const current = await getState()
        if (current.status === 'running') {
          sendResponse({ state: current })
          break
        }
        sendResponse({ state: await startCampaign(Boolean(msg.simulated)) })
        break
      }
      case 'PAUSE': {
        const s = await getState()
        if (s.status === 'running') {
          s.status = 'paused'
          await setState(s)
          await chrome.alarms.clear(ALARM_NEXT)
        }
        sendResponse({ state: await getState() })
        break
      }
      case 'RESUME': {
        const s = await getState()
        if (s.status === 'paused') {
          s.status = 'running'
          await setState(s)
          chrome.alarms.create(ALARM_NEXT, { when: Date.now() + 500 })
        }
        sendResponse({ state: await getState() })
        break
      }
      case 'RETRY_SYNC': {
        await retrySync()
        sendResponse({ state: await getState() })
        break
      }
      case 'RESET_CAMPAIGN': {
        await setState({ ...IDLE })
        await chrome.alarms.clear(ALARM_NEXT)
        await chrome.alarms.clear(ALARM_SYNC)
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
          sendResponse({ ok: false, error: 'Could not read this page — reload it and try again.' })
        }
        break
      }
      default:
        sendResponse({ ok: false, error: 'Unknown message type.' })
    }
  })()
  return true
})

export {}
