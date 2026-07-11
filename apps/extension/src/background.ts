import { appendUtm } from '@usersessions/shared'
import type { BridgeMessage, GeneratedCopy, PlatformResult, SiteData } from '@usersessions/shared'

import { fetchVerifications, postCampaign } from './api'
import { ADAPTERS, getAdapter } from './adapters/registry'
import type { AdapterOutcome, FounderProfile, RunContext } from './adapters/types'

/**
 * Background service worker — MV3-SAFE BY CONSTRUCTION:
 * all campaign state (including a run paused for the human) lives in
 * chrome.storage.local and step delays use chrome.alarms, so pause/resume and
 * in-flight campaigns survive worker restarts (BUILD_SPEC §7).
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
/** A run paused for the human: CAPTCHA, OTP, or email confirmation (assisted automation, BUILD_SPEC §1). */
export interface PendingAction {
  platformId: string
  tabId: number
  nextStep: number
  reason: 'captcha' | 'otp' | 'email_verification' | 'login'
  message: string
  needsInput: boolean
  context: RunContext
}

export interface CampaignRunState {
  status: 'idle' | 'running' | 'paused' | 'awaiting_user_action' | 'done' | 'plan_limit' | 'sync_error'
  campaignId?: string
  productId?: string
  startedAt?: string
  /** True when the user explicitly requested a simulation run. */
  simulated: boolean
  /** Per-platform live verification (adapter_verifications via dashboard). Missing/false → simulation. */
  verified: Record<string, boolean>
  queue: string[]
  currentPlatform?: string
  pending?: PendingAction
  results: PlatformResult[]
}

const STATE_KEY = 'campaignState'
const ALARM_NEXT = 'campaign-next'
const ALARM_SYNC = 'campaign-sync-retry'
const IDLE: CampaignRunState = { status: 'idle', simulated: true, verified: {}, queue: [], results: [] }

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

/**
 * Effective mode for ONE platform: a requested simulation simulates everything;
 * otherwise only adapters the user verified in the dashboard run live (M6, now
 * per-platform). FAIL-CLOSED: a missing map entry means simulation.
 */
const simFor = (state: CampaignRunState, platformId: string): boolean =>
  state.simulated || !(state.verified ?? {})[platformId]

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

  // M6 GATE, PER-PLATFORM: an adapter runs live only when the user verified it in the
  // dashboard (adapter_verifications) or the registry itself is verified by proof.
  // Unverified adapters in the same campaign still run in simulation — fail-closed.
  const dbVerified = await fetchVerifications()
  const verified: Record<string, boolean> = {}
  for (const a of ADAPTERS) verified[a.platformId] = a.verified || dbVerified[a.platformId] === true
  const simulated = requestedSimulated

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
    verified,
    queue: ADAPTERS.map((a) => a.platformId),
    results: [],
  }
  await setState(state)
  chrome.alarms.create(ALARM_NEXT, { when: Date.now() + 500 })
  return state
}

function waitForTabLoad(tabId: number): Promise<void> {
  return new Promise((resolve) => {
    chrome.tabs
      .get(tabId)
      .then((tab) => {
        if (tab.status === 'complete') return resolve()

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
      .catch(() => {
        // Tab may have been closed before we attached listeners.
        resolve()
      })
  })
}

async function sendMessageWithRetry(tabId: number, message: any, retries = 5, delayMs = 1000): Promise<any> {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await chrome.tabs.sendMessage(tabId, message)
      if (res === undefined && chrome.runtime.lastError) {
        throw new Error(chrome.runtime.lastError.message)
      }
      return res
    } catch (err: any) {
      if (i === retries - 1) throw err
      if (String(err).includes('Receiving end does not exist') || String(err).includes('establish connection')) {
        await new Promise((r) => setTimeout(r, delayMs))
      } else {
        throw err
      }
    }
  }
}

// ---------- Screenshots (context-aware asset engine) ----------
const GIT_HOST = /^https?:\/\/(www\.)?(github\.com|gitlab\.com|bitbucket\.org)\//i

async function storeScreenshot(key: string, dataUrl: string): Promise<void> {
  const { screenshots } = await chrome.storage.local.get('screenshots')
  const map = (screenshots as Record<string, string> | undefined) ?? {}
  map[key] = dataUrl
  await chrome.storage.local.set({ screenshots: map })
}

/** Captured media for this platform run, re-readable on resume (data URLs). */
async function assetsFor(campaignId: string, platformId: string): Promise<Record<string, string>> {
  const { screenshots } = await chrome.storage.local.get('screenshots')
  const map = (screenshots as Record<string, string> | undefined) ?? {}
  const assets: Record<string, string> = {}
  const hero = map[`${campaignId}:${platformId}:product`]
  if (hero) assets.productHero = hero
  const second = map[`${campaignId}:${platformId}:product2`]
  if (second) assets.productGallery = second
  const logo = map[`${campaignId}:${platformId}:logo`]
  if (logo) assets.logo = logo
  return assets
}

/**
 * Captures gallery shots of the founder's landing page for platforms that require
 * gallery images: a 16:9 top-anchored hero, plus a second scrolled shot for galleries
 * that expect multiple images. Git-repo URLs are skipped unless the platform explicitly
 * requires a shot — a code listing makes a bad gallery image.
 */
async function captureProductShots(
  productUrl: string,
  required: boolean
): Promise<{ hero?: string; second?: string; logo?: string }> {
  if (GIT_HOST.test(productUrl) && !required) return {}
  try {
    const tab = await chrome.tabs.create({ url: productUrl, active: true }) // captureVisibleTab needs the active tab
    await waitForTabLoad(tab.id!)
    await new Promise((r) => setTimeout(r, 1_000)) // let hero imagery paint
    const heroRaw = await chrome.tabs.captureVisibleTab(tab.windowId!, { format: 'png' })
    const hero = await cropDataUrl(heroRaw, 16 / 9)
    let second: string | undefined
    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id! },
        func: () => window.scrollTo(0, window.innerHeight),
      })
      await new Promise((r) => setTimeout(r, 700))
      second = await cropDataUrl(await chrome.tabs.captureVisibleTab(tab.windowId!, { format: 'png' }), 16 / 9)
    } catch {
      /* the second shot is a bonus, never a blocker */
    }
    const logo = await captureLogo(tab.id!)
    void chrome.tabs.remove(tab.id!)
    return { hero, second, logo }
  } catch {
    return {} // asset capture is best-effort; the submission proceeds without it
  }
}

/** Blob → data URL inside the MV3 service worker (no FileReader available). */
async function blobToDataUrl(blob: Blob): Promise<string> {
  const buf = new Uint8Array(await blob.arrayBuffer())
  let bin = ''
  for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000))
  return `data:${blob.type || 'image/png'};base64,${btoa(bin)}`
}

/** Best-effort 1:1 logo: apple-touch-icon → og:image → favicon, center-cropped square. */
async function captureLogo(tabId: number): Promise<string | undefined> {
  try {
    const [{ result }] = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => {
        const link = (sel: string) => document.querySelector<HTMLLinkElement>(sel)?.href
        return (
          link('link[rel="apple-touch-icon"]') ||
          link('link[rel="apple-touch-icon-precomposed"]') ||
          document.querySelector<HTMLMetaElement>('meta[property="og:image"]')?.content ||
          link('link[rel="icon"]') ||
          link('link[rel="shortcut icon"]') ||
          null
        )
      },
    })
    if (!result) return undefined
    const res = await fetch(String(result))
    if (!res.ok) return undefined
    return await cropDataUrl(await blobToDataUrl(await res.blob()), 1) // 1:1 logo
  } catch {
    return undefined // logo is always optional media
  }
}

/** Center-crop a PNG data URL to the given aspect ratio (top-anchored). Best-effort. */
async function cropDataUrl(dataUrl: string, ratio: number): Promise<string> {
  try {
    const blob = await (await fetch(dataUrl)).blob()
    const bmp = await createImageBitmap(blob)
    let w = bmp.width
    let h = bmp.height
    if (w / h > ratio) w = Math.round(h * ratio)
    else h = Math.round(w / ratio)
    const canvas = new OffscreenCanvas(w, h)
    const ctx = canvas.getContext('2d')
    if (!ctx) return dataUrl
    ctx.drawImage(bmp, Math.round((bmp.width - w) / 2), 0, w, h, 0, 0, w, h)
    const out = await canvas.convertToBlob({ type: 'image/png' })
    const buf = new Uint8Array(await out.arrayBuffer())
    let bin = ''
    for (let i = 0; i < buf.length; i += 0x8000) {
      bin += String.fromCharCode(...buf.subarray(i, i + 0x8000))
    }
    return `data:image/png;base64,${btoa(bin)}`
  } catch {
    return dataUrl // crop is best-effort; the raw shot still works
  }
}

function toResult(
  platformId: string,
  outcome: AdapterOutcome,
  simulated: boolean,
  requiresEmailVerification: boolean
): PlatformResult {
  switch (outcome.outcome) {
    case 'filled':
      return { platformId, status: 'submitted', simulated }
    case 'submitted':
      return {
        platformId,
        // Platforms that confirm by email are NOT 'submitted' yet — surface the truth.
        status: requiresEmailVerification && !simulated ? 'awaiting_email_verification' : 'submitted',
        simulated,
      }
    case 'needs_human': // reached only when a pause is finalized unresolved (skip)
      return { platformId, status: 'failed', simulated, error: `needs you: ${outcome.message}` }
    case 'failed':
      return { platformId, status: 'failed', simulated, error: outcome.error }
  }
}

/**
 * Central outcome handler for first runs AND resumed runs.
 * needs_human → park the campaign, badge the icon, focus the tab, wait for the human.
 * Anything else → finalize the platform result, tidy tabs, schedule the next platform.
 */
async function settleOutcome(
  platformId: string,
  tabId: number | undefined,
  outcome: AdapterOutcome,
  context: RunContext
): Promise<void> {
  const state = await getState()

  if (outcome.outcome === 'needs_human' && tabId !== undefined) {
    state.status = 'awaiting_user_action'
    state.currentPlatform = platformId
    state.pending = {
      platformId,
      tabId,
      nextStep: outcome.nextStep,
      reason: outcome.reason,
      message: outcome.message,
      needsInput: outcome.reason === 'otp',
      context,
    }
    await setState(state)
    void chrome.action.setBadgeText({ text: '!' })
    void chrome.action.setBadgeBackgroundColor({ color: '#B45309' })
    void chrome.tabs.update(tabId, { active: true }) // put the human exactly where they're needed
    // System notification too — the badge is invisible when the user is in another app.
    const iconPath = chrome.runtime.getManifest().icons?.['128']
    if (iconPath) {
      void chrome.notifications.create('needs-you', {
        type: 'basic',
        iconUrl: chrome.runtime.getURL(iconPath),
        title: `${platformId} needs you`,
        message: outcome.message,
        priority: 2,
      })
    }
    return
  }

  const adapter = getAdapter(platformId)
  const sim = simFor(state, platformId)
  const result = toResult(
    platformId,
    outcome,
    sim,
    Boolean(adapter?.requirements?.requiresEmailVerification)
  )

  // Proof shot: on live success, capture the post-submit page for the user's records.
  if (!sim && outcome.outcome === 'submitted' && tabId !== undefined) {
    try {
      const tab = await chrome.tabs.get(tabId)
      const shot = await chrome.tabs.captureVisibleTab(tab.windowId!, { format: 'png' })
      await storeScreenshot(`${state.campaignId}:${platformId}:proof`, shot)
    } catch {
      /* best-effort */
    }
  }

  // No dead tabs: simulation tabs always close; live tabs close on failure.
  // Email-verification and submitted tabs stay open briefly for the user; failures never linger.
  if (tabId !== undefined && (sim || result.status === 'failed')) void chrome.tabs.remove(tabId)

  state.results = [...state.results, result]
  state.currentPlatform = undefined
  state.pending = undefined
  if (state.status === 'awaiting_user_action') state.status = 'running'
  await setState(state)
  void chrome.action.setBadgeText({ text: '' })
  void chrome.notifications.clear('needs-you')

  if (state.status === 'running') {
    chrome.alarms.create(ALARM_NEXT, { when: Date.now() + nextDelayMs(sim) })
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
  } else if (res.ok === false && res.error === 'PLAN_LIMIT_EXCEEDED') {
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
  const { siteData, approvedCopy, founderProfile } = await chrome.storage.local.get([
    'siteData',
    'approvedCopy',
    'founderProfile',
  ])
  const site = siteData as SiteData | undefined
  const copy = (approvedCopy as GeneratedCopy[]) ?? []
  const profile = (founderProfile as FounderProfile | undefined) ?? {}

  const categoryCopy = copy.find((c) => c.category === adapter?.category) ?? copy[0]
  const context: RunContext = {
    title: site?.title ?? '',
    url: site ? appendUtm(site.url, state.campaignId!) : '', // UTM on every URL before submission (BUILD_SPEC §7)
    tagline: site?.tagline ?? categoryCopy?.hook ?? '',
    hook: categoryCopy?.hook ?? '',
    body: categoryCopy?.body ?? '',
    founderName: profile.founderName ?? '',
    contactEmail: profile.contactEmail ?? '',
    category: adapter?.category ?? '',
    tags: profile.tags?.length ? profile.tags : site?.keywords ?? [],
    pricingModel: profile.pricingModel ?? '',
    socialLinks: profile.socialLinks ?? {},
    userInput: '',
  }

  if (!adapter || !site) {
    await settleOutcome(platformId, undefined, { outcome: 'failed', error: 'no adapter or site data' }, context)
    return
  }

  // Context-aware asset generation: 16:9 hero + scrolled gallery shot + 1:1 logo where needed.
  const sim = simFor(state, platformId)
  const needsMedia =
    adapter.requirements?.requiresScreenshot || adapter.steps.some((s) => s.op === 'upload')
  if (needsMedia && !sim) {
    const shots = await captureProductShots(site.url, true)
    if (shots.hero) await storeScreenshot(`${state.campaignId}:${platformId}:product`, shots.hero)
    if (shots.second) await storeScreenshot(`${state.campaignId}:${platformId}:product2`, shots.second)
    if (shots.logo) await storeScreenshot(`${state.campaignId}:${platformId}:logo`, shots.logo)
  }

  let tabId: number | undefined
  try {
    const tab = await chrome.tabs.create({ url: adapter.submitUrl, active: true })
    tabId = tab.id
    await waitForTabLoad(tab.id!)
    const outcome = (await sendMessageWithRetry(tab.id!, {
      type: 'RUN_ADAPTER',
      steps: adapter.steps,
      context,
      simulated: sim,
      resumeFrom: 0,
      assets: await assetsFor(state.campaignId!, platformId),
    })) as AdapterOutcome
    await settleOutcome(platformId, tabId, outcome, context)
  } catch (err) {
    if (tabId !== undefined) void chrome.tabs.remove(tabId) // never leave a broken, unfilled tab behind
    await settleOutcome(platformId, undefined, { outcome: 'failed', error: String(err) }, context)
  }
}

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === ALARM_NEXT) void processNext()
  if (alarm.name === ALARM_SYNC) void retrySync()
})

// Clicking the "needs you" notification jumps straight to the paused tab.
chrome.notifications.onClicked.addListener((id) => {
  if (id !== 'needs-you') return
  void (async () => {
    const state = await getState()
    if (state.pending) {
      const tab = await chrome.tabs.get(state.pending.tabId).catch(() => null)
      if (tab?.windowId !== undefined) void chrome.windows.update(tab.windowId, { focused: true })
      void chrome.tabs.update(state.pending.tabId, { active: true })
    }
    chrome.notifications.clear(id)
  })()
})

// ---------- Popup ↔ background messaging ----------
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  void (async () => {
    try {
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
        if (current.status === 'running' || current.status === 'awaiting_user_action') {
          sendResponse({ state: current })
          break
        }
        sendResponse({ state: await startCampaign(Boolean(msg.simulated)) })
        break
      }
      case 'RESUME_USER_ACTION': {
        // The human acted (solved CAPTCHA / read their OWN email and typed the code).
        const s = await getState()
        if (s.status !== 'awaiting_user_action' || !s.pending) {
          sendResponse({ state: s })
          break
        }
        const p = s.pending
        const adapter = getAdapter(p.platformId)

        // If the user closed the paused tab, fail this platform gracefully and continue.
        const pausedTab = await chrome.tabs.get(p.tabId).catch(() => null)
        if (!pausedTab?.id) {
          await settleOutcome(
            p.platformId,
            undefined,
            { outcome: 'failed', error: 'paused tab was closed before resume' },
            p.context
          )
          sendResponse({ state: await getState() })
          break
        }

        s.status = 'running'
        await setState(s)
        void chrome.action.setBadgeText({ text: '' })
        const context: RunContext = {
          ...p.context,
          userInput: typeof msg.userInput === 'string' ? msg.userInput : '',
        }
        try {
          const outcome = (await sendMessageWithRetry(p.tabId, {
            type: 'RUN_ADAPTER',
            steps: adapter?.steps ?? [],
            context,
            simulated: simFor(s, p.platformId),
            resumeFrom: p.nextStep,
            assets: await assetsFor(s.campaignId!, p.platformId),
          })) as AdapterOutcome
          await settleOutcome(p.platformId, p.tabId, outcome, context)
        } catch (err) {
          await settleOutcome(p.platformId, p.tabId, { outcome: 'failed', error: String(err) }, context)
        }
        sendResponse({ state: await getState() })
        break
      }
      case 'SKIP_USER_ACTION': {
        const s = await getState()
        if (s.status !== 'awaiting_user_action' || !s.pending) {
          sendResponse({ state: s })
          break
        }
        const p = s.pending
        s.status = 'running'
        await setState(s)
        void chrome.action.setBadgeText({ text: '' })
        // Honest failure; the tab stays open so the human can finish by hand if they want.
        await settleOutcome(
          p.platformId,
          undefined,
          { outcome: 'failed', error: `skipped: ${p.message}` },
          p.context
        )
        sendResponse({ state: await getState() })
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
        void chrome.action.setBadgeText({ text: '' })
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
      case 'START_AGENT': {
        const { startAgentSession } = await import('./agent/orchestrator')
        sendResponse(await startAgentSession(String(msg.platformId ?? '')))
        break
      }
      case 'RESUME_AGENT': {
        const { resumeAgentSession } = await import('./agent/orchestrator')
        sendResponse(await resumeAgentSession(String(msg.sessionId ?? '')))
        break
      }
      case 'ABORT_AGENT': {
        const { abortAgentSession } = await import('./agent/orchestrator')
        sendResponse(await abortAgentSession(String(msg.sessionId ?? '')))
        break
      }
      case 'GET_AGENT_SESSIONS': {
        const { listAgentSessions } = await import('./agent/orchestrator')
        sendResponse({ sessions: await listAgentSessions() })
        break
      }
      case 'GET_SURFACES': {
        const { fetchSurfaces } = await import('./surfaces')
        sendResponse({ surfaces: await fetchSurfaces() })
        break
      }
      case 'DISTRIBUTE_SURFACE': {
        // Assisted distribution: open the surface, draft copy, inject the editable sidebar.
        const { fetchSurfaceCopy } = await import('./surfaces')
        const { siteData } = await chrome.storage.local.get('siteData')
        const site = siteData as SiteData | undefined
        if (!site?.title) {
          sendResponse({ ok: false, error: 'Analyze your product page first.' })
          break
        }
        const surfaceId = String(msg.surfaceId ?? '')
        const openUrl = typeof msg.url === 'string' && msg.url ? msg.url : site.url
        const copyRes = await fetchSurfaceCopy({
          surfaceId,
          title: site.title,
          url: site.url,
          description: site.description ?? '',
        })
        if (!copyRes.ok) {
          sendResponse({ ok: false, error: copyRes.error })
          break
        }
        const tab = await chrome.tabs.create({ url: openUrl, active: true })
        await waitForTabLoad(tab.id!)
        // Track which surface this tab is drafting, for screenshot/mark-submitted.
        await chrome.storage.local.set({
          [`surfaceTab:${tab.id}`]: { surfaceId, campaignId: crypto.randomUUID() },
        })
        try {
          await sendMessageWithRetry(tab.id!, {
            type: 'RENDER_SURFACE_PANEL',
            data: { surfaceId, surfaceName: String(msg.surfaceName ?? 'this surface'), copy: copyRes.copy },
          })
        } catch {
          /* sidebar injection is best-effort; the tab is still open for the user */
        }
        sendResponse({ ok: true })
        break
      }
      case 'SURFACE_SCREENSHOT': {
        const tabId = _sender.tab?.id
        if (tabId === undefined) {
          sendResponse({ ok: false })
          break
        }
        try {
          const tab = await chrome.tabs.get(tabId)
          const shot = await chrome.tabs.captureVisibleTab(tab.windowId!, { format: 'png' })
          await storeScreenshot(`surface:${String(msg.surfaceId)}:proof`, shot)
          sendResponse({ ok: true })
        } catch {
          sendResponse({ ok: false })
        }
        break
      }
      case 'SURFACE_MARK_SUBMITTED': {
        const tabId = _sender.tab?.id
        const { postSurfaceSubmission } = await import('./surfaces-submit')
        const meta = tabId !== undefined ? (await chrome.storage.local.get(`surfaceTab:${tabId}`))[`surfaceTab:${tabId}`] : undefined
        const res = await postSurfaceSubmission({
          surfaceId: String(msg.surfaceId),
          campaignId: meta?.campaignId ?? crypto.randomUUID(),
        })
        sendResponse({ ok: res.ok })
        break
      }
      default:
        sendResponse({ ok: false, error: 'Unknown message type.' })
      }
    } catch (err) {
      sendResponse({ ok: false, error: String(err) })
    }
  })()
  return true
})

export {}
