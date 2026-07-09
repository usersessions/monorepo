import { appendUtm } from '@usersessions/shared'
import type {
  ActionPlan,
  AgentAction,
  AgentRunContext,
  AgentSession,
  GeneratedCopy,
  PerceptionPayload,
  SiteData,
} from '@usersessions/shared'

import { ADAPTERS, getAdapter } from '../adapters/registry'
import type { AdapterOutcome, FounderProfile } from '../adapters/types'
import { fetchVerifications } from '../api'
import { captureCompressed } from './screenshot'

/**
 * Agent orchestrator — the SEE→THINK→ACT loop (Computer Use).
 * PERCEIVE in the tab, PLAN on the dashboard AI, ACT in the tab, VERIFY, repeat.
 * Safety rails (non-negotiable): domain lock, 2s min action interval, 50-step
 * budget, 5 sessions/hour, pause (never fight) on login/CAPTCHA, and the M6
 * gate — unverified platforms run with the final submit SKIPPED, fail-closed.
 */

const DASHBOARD_URL = process.env.PLASMO_PUBLIC_DASHBOARD_URL ?? 'https://usersessions.io'
const SESSIONS_KEY = 'agentSessions'
const STARTS_KEY = 'agentSessionStarts'
const MAX_STEPS = 50
const MAX_ACTIONS_PER_PLAN = 3
const MIN_ACTION_INTERVAL_MS = 2_000
const MAX_SESSIONS_PER_HOUR = 5
const MAX_CONSECUTIVE_FAILURES = 3

/** Domain lock: platform submit hosts + the auth providers their login flows bounce through. */
const AUTH_HOSTS = ['accounts.google.com', 'github.com', 'twitter.com', 'x.com', 'api.twitter.com', 'appleid.apple.com']

function allowedHosts(): string[] {
  const hosts = ADAPTERS.map((a) => {
    try {
      return new URL(a.submitUrl).hostname.replace(/^www\./, '')
    } catch {
      return ''
    }
  }).filter(Boolean)
  return [...new Set([...hosts, ...AUTH_HOSTS])]
}

function hostAllowed(url: string | undefined): boolean {
  if (!url) return false
  try {
    const host = new URL(url).hostname.replace(/^www\./, '')
    return allowedHosts().some((h) => host === h || host.endsWith(`.${h}`))
  } catch {
    return false
  }
}

// ---------- Session persistence (chrome.storage.local — survives SW restarts) ----------
async function getSessions(): Promise<Record<string, AgentSession>> {
  const stored = await chrome.storage.local.get(SESSIONS_KEY)
  return (stored[SESSIONS_KEY] as Record<string, AgentSession>) ?? {}
}

async function saveSession(session: AgentSession): Promise<void> {
  const all = await getSessions()
  all[session.id] = session
  await chrome.storage.local.set({ [SESSIONS_KEY]: all })
}

export async function listAgentSessions(): Promise<AgentSession[]> {
  const all = await getSessions()
  return Object.values(all)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, 10)
}

// ---------- Rate limit (client side; the server enforces the same budget) ----------
async function underHourlyLimit(): Promise<boolean> {
  const { [STARTS_KEY]: starts } = await chrome.storage.local.get(STARTS_KEY)
  const now = Date.now()
  const recent = ((starts as number[]) ?? []).filter((t) => now - t < 3_600_000)
  await chrome.storage.local.set({ [STARTS_KEY]: recent })
  return recent.length < MAX_SESSIONS_PER_HOUR
}

async function recordStart(): Promise<void> {
  const { [STARTS_KEY]: starts } = await chrome.storage.local.get(STARTS_KEY)
  await chrome.storage.local.set({ [STARTS_KEY]: [...(((starts as number[]) ?? [])), Date.now()] })
}

// ---------- Dashboard sync (best-effort; local state is the source of truth) ----------
async function syncSession(session: AgentSession): Promise<void> {
  const { accessToken } = await chrome.storage.local.get('accessToken')
  if (!accessToken) return
  try {
    await fetch(`${DASHBOARD_URL}/api/agent/session`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(session),
    })
  } catch {
    /* best-effort */
  }
}

// ---------- Tab messaging ----------
async function sendToTab<T>(tabId: number, message: unknown, retries = 5): Promise<T> {
  for (let i = 0; ; i++) {
    try {
      return (await chrome.tabs.sendMessage(tabId, message)) as T
    } catch (err) {
      if (i >= retries - 1) throw err
      await new Promise((r) => setTimeout(r, 1_000))
    }
  }
}

function waitForTabLoad(tabId: number): Promise<void> {
  return new Promise((resolve) => {
    void chrome.tabs.get(tabId).then((tab) => {
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
  })
}

// ---------- PERCEIVE ----------
async function perceive(session: AgentSession): Promise<PerceptionPayload> {
  const payload = await sendToTab<PerceptionPayload>(session.tabId!, {
    type: 'AGENT_PERCEIVE',
    sessionId: session.id,
    stepIndex: session.currentStep,
    platformId: session.platformId,
  })
  try {
    const tab = await chrome.tabs.get(session.tabId!)
    payload.screenshotBase64 = await captureCompressed(tab.windowId!)
  } catch {
    /* screenshot is optional context */
  }
  return payload
}

// ---------- PLAN ----------
type PlanResult = { ok: true; plan: ActionPlan } | { ok: false; error: 'AUTH' | 'RATE_LIMITED' | 'UNAVAILABLE' }

async function fetchPlan(session: AgentSession, perception: PerceptionPayload): Promise<PlanResult> {
  const { accessToken } = await chrome.storage.local.get('accessToken')
  if (!accessToken) return { ok: false, error: 'AUTH' }
  try {
    const res = await fetch(`${DASHBOARD_URL}/api/agent/plan`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: session.id,
        platformId: session.platformId,
        campaignId: session.campaignId,
        productId: session.productId,
        stepIndex: session.currentStep,
        simulated: session.simulated,
        perception,
        runContext: session.runContext,
        history: session.history.slice(-10),
      }),
    })
    if (res.status === 401) return { ok: false, error: 'AUTH' }
    if (res.status === 429) return { ok: false, error: 'RATE_LIMITED' }
    if (!res.ok) return { ok: false, error: 'UNAVAILABLE' }
    return { ok: true, plan: (await res.json()) as ActionPlan }
  } catch {
    return { ok: false, error: 'UNAVAILABLE' }
  }
}

/**
 * Fallback strategy (spec Part 3): after 3 consecutive planner failures, run the
 * PROVEN declarative adapter engine for this platform. If that also needs a human,
 * pause honestly instead of failing silently.
 */
async function ruleBasedFallback(session: AgentSession): Promise<void> {
  const adapter = getAdapter(session.platformId)
  if (adapter && session.tabId !== undefined) {
    try {
      const outcome = await sendToTab<AdapterOutcome>(session.tabId, {
        type: 'RUN_ADAPTER',
        steps: adapter.steps,
        context: session.runContext,
        simulated: session.simulated,
        resumeFrom: 0,
        assets: {},
      })
      if (outcome.outcome === 'filled' || outcome.outcome === 'submitted') {
        await completeSession(session, 'success')
        return
      }
      if (outcome.outcome === 'needs_human') {
        await pauseSession(session, outcome.reason === 'captcha' ? 'captcha' : 'auth_required', outcome.message)
        return
      }
    } catch {
      /* fall through to pause */
    }
  }
  await pauseSession(
    session,
    'human_verification',
    'AI planning and rule-based execution both failed — finish this platform by hand, or abort.'
  )
}

// ---------- State transitions ----------
async function pauseSession(
  session: AgentSession,
  reason: 'auth_required' | 'captcha' | 'human_verification',
  message: string
): Promise<void> {
  session.status = 'paused'
  session.pausedReason = `${reason}: ${message}`
  session.updatedAt = new Date().toISOString()
  await saveSession(session)
  void chrome.action.setBadgeText({ text: '!' })
  void chrome.action.setBadgeBackgroundColor({ color: '#B45309' })
  try {
    chrome.notifications.create(`agent-${session.id}`, {
      type: 'basic',
      iconUrl: chrome.runtime.getURL('assets/icon.png'),
      title: 'Agent paused — needs you',
      message: `${session.platformId}: ${message}`.slice(0, 250),
    })
  } catch {
    /* notifications are best-effort */
  }
  if (session.tabId !== undefined) void chrome.tabs.update(session.tabId, { active: true })
  void syncSession(session)
}

async function completeSession(session: AgentSession, result: 'success' | 'already_exists' | 'error'): Promise<void> {
  session.status = result === 'error' ? 'failed' : 'completed'
  session.result = result
  session.updatedAt = new Date().toISOString()
  await saveSession(session)
  void chrome.action.setBadgeText({ text: '' })
  void syncSession(session)
}

async function failSession(session: AgentSession, error: string): Promise<void> {
  session.status = 'failed'
  session.result = 'error'
  session.pausedReason = error
  session.updatedAt = new Date().toISOString()
  await saveSession(session)
  void chrome.action.setBadgeText({ text: '' })
  void syncSession(session)
}

// ---------- The loop ----------
export async function runAgentLoop(sessionId: string): Promise<void> {
  let failures = 0
  for (;;) {
    const session = (await getSessions())[sessionId]
    if (!session || session.status !== 'running') return
    if (session.currentStep >= MAX_STEPS) {
      await failSession(session, 'step budget exhausted (50 steps)')
      return
    }

    // Tab liveness + domain lock — the agent may only operate on whitelisted hosts.
    let tabUrl: string | undefined
    try {
      tabUrl = (await chrome.tabs.get(session.tabId!)).url
    } catch {
      await failSession(session, 'tab was closed')
      return
    }
    if (!hostAllowed(tabUrl)) {
      await failSession(session, `aborted: navigation outside allowed domains (${tabUrl ?? 'unknown'})`)
      return
    }

    // 1. PERCEIVE
    let perception: PerceptionPayload
    try {
      perception = await perceive(session)
    } catch (err) {
      await failSession(session, `perception failed: ${String(err)}`)
      return
    }

    // 2. Hard pause gates — never fight auth or CAPTCHA.
    if (perception.pageType === 'login_gate') {
      await pauseSession(session, 'auth_required', `Log in on ${perception.url}, then resume from the popup.`)
      return
    }
    if (perception.pageType === 'captcha') {
      await pauseSession(session, 'captcha', 'Solve the CAPTCHA in the tab, then resume from the popup.')
      return
    }

    // 3. PLAN
    const planRes = await fetchPlan(session, perception)
    if (planRes.ok === false) {
      if (planRes.error === 'AUTH') {
        await pauseSession(session, 'auth_required', 'Sign in on the dashboard to reconnect the agent, then resume.')
        return
      }
      if (planRes.error === 'RATE_LIMITED') {
        await failSession(session, 'server rate limit: max 5 agent sessions per hour')
        return
      }
      failures += 1
      if (failures >= MAX_CONSECUTIVE_FAILURES) {
        await ruleBasedFallback(session)
        return
      }
      await new Promise((r) => setTimeout(r, 3_000))
      continue
    }
    const plan = planRes.plan

    // 4. Terminal decisions from the planner.
    const pauseAction = plan.actions.find((a) => a.type === 'pause') as Extract<AgentAction, { type: 'pause' }> | undefined
    if (pauseAction) {
      await pauseSession(session, pauseAction.reason, pauseAction.message)
      return
    }
    const completeAction = plan.actions.find((a) => a.type === 'complete') as
      | Extract<AgentAction, { type: 'complete' }>
      | undefined
    if (completeAction) {
      await completeSession(session, completeAction.result)
      return
    }

    // 5. ACT (max 3 actions, >=2s apart) then VERIFY via DOM stability.
    let anySucceeded = false
    for (const action of plan.actions.slice(0, MAX_ACTIONS_PER_PLAN)) {
      if (action.type === 'navigate' && !hostAllowed(action.url)) {
        await failSession(session, `aborted: planner attempted navigation to ${action.url}`)
        return
      }
      await new Promise((r) => setTimeout(r, MIN_ACTION_INTERVAL_MS))
      let success = false
      try {
        const res = await sendToTab<{ success: boolean }>(session.tabId!, {
          type: 'AGENT_EXECUTE',
          action,
          simulated: session.simulated,
        })
        success = Boolean(res?.success)
      } catch {
        success = false
      }
      if (!success && plan.fallbackActions?.length) {
        for (const fb of plan.fallbackActions.slice(0, MAX_ACTIONS_PER_PLAN)) {
          if (fb.type === 'navigate' && !hostAllowed(fb.url)) continue
          await new Promise((r) => setTimeout(r, MIN_ACTION_INTERVAL_MS))
          try {
            const res = await sendToTab<{ success: boolean }>(session.tabId!, {
              type: 'AGENT_EXECUTE',
              action: fb,
              simulated: session.simulated,
            })
            if (res?.success) {
              success = true
              break
            }
          } catch {
            /* keep trying fallbacks */
          }
        }
      }
      anySucceeded = anySucceeded || success
      session.history = [...session.history, action].slice(-100)
      if (action.type === 'navigate' || action.type === 'submit') {
        await new Promise((r) => setTimeout(r, 1_500)) // let navigation start
        await waitForTabLoad(session.tabId!)
      }
      try {
        await sendToTab(session.tabId!, { type: 'AGENT_WAIT_STABLE', maxMs: 8_000 }, 3)
      } catch {
        /* page may be mid-navigation; the next perceive re-checks */
      }
    }

    failures = anySucceeded ? 0 : failures + 1
    if (failures >= MAX_CONSECUTIVE_FAILURES) {
      await ruleBasedFallback(session)
      return
    }

    session.currentStep += 1
    session.updatedAt = new Date().toISOString()
    await saveSession(session)
    void syncSession(session)
  }
}

// ---------- Public API (wired into background.ts message switch) ----------
export async function startAgentSession(
  platformId: string
): Promise<{ ok: boolean; error?: string; session?: AgentSession }> {
  const adapter = getAdapter(platformId)
  if (!adapter) return { ok: false, error: `Unknown platform: ${platformId}` }
  if (!(await underHourlyLimit())) return { ok: false, error: 'Rate limit: max 5 agent sessions per hour.' }

  const { siteData, approvedCopy, founderProfile, accessToken, productIdByUrl } = await chrome.storage.local.get([
    'siteData',
    'approvedCopy',
    'founderProfile',
    'accessToken',
    'productIdByUrl',
  ])
  if (!accessToken) return { ok: false, error: 'Connect first — sign in on the dashboard.' }
  const site = siteData as SiteData | undefined
  const copy = (approvedCopy as GeneratedCopy[] | undefined) ?? []
  if (!site || copy.length === 0) return { ok: false, error: 'Analyze your page and approve copy first.' }

  // M6 gate, fail-closed: live submit ONLY when this platform is verified.
  const dbVerified = await fetchVerifications()
  const simulated = !(adapter.verified || dbVerified[platformId] === true)

  const ids = ((productIdByUrl as Record<string, string> | undefined) ?? {})
  if (!ids[site.url]) {
    ids[site.url] = crypto.randomUUID()
    await chrome.storage.local.set({ productIdByUrl: ids })
  }

  const profile = (founderProfile as FounderProfile | undefined) ?? {}
  const categoryCopy = copy.find((c) => c.category === adapter.category) ?? copy[0]
  const campaignId = crypto.randomUUID()
  const runContext: AgentRunContext = {
    title: site.title ?? '',
    url: appendUtm(site.url, campaignId),
    tagline: site.tagline ?? categoryCopy?.hook ?? '',
    hook: categoryCopy?.hook ?? '',
    body: categoryCopy?.body ?? '',
    founderName: profile.founderName ?? '',
    contactEmail: profile.contactEmail ?? '',
    category: adapter.category,
    tags: profile.tags?.length ? profile.tags : site.keywords ?? [],
    pricingModel: profile.pricingModel ?? '',
    socialLinks: profile.socialLinks ?? {},
    userInput: '',
  }

  const tab = await chrome.tabs.create({ url: adapter.submitUrl, active: true })
  const now = new Date().toISOString()
  const session: AgentSession = {
    id: crypto.randomUUID(),
    platformId,
    campaignId,
    productId: ids[site.url],
    status: 'running',
    currentStep: 0,
    totalSteps: adapter.steps.length,
    simulated,
    runContext,
    history: [],
    tabId: tab.id,
    createdAt: now,
    updatedAt: now,
  }
  await recordStart()
  await saveSession(session)
  void syncSession(session)
  await waitForTabLoad(tab.id!)
  void runAgentLoop(session.id)
  return { ok: true, session }
}

export async function resumeAgentSession(
  sessionId: string
): Promise<{ ok: boolean; error?: string; session?: AgentSession }> {
  const session = (await getSessions())[sessionId]
  if (!session) return { ok: false, error: 'Unknown session.' }
  if (session.status !== 'paused') return { ok: true, session }
  session.status = 'running'
  session.pausedReason = undefined
  session.updatedAt = new Date().toISOString()
  await saveSession(session)
  void chrome.action.setBadgeText({ text: '' })
  void syncSession(session)
  void runAgentLoop(sessionId)
  return { ok: true, session }
}

export async function abortAgentSession(
  sessionId: string
): Promise<{ ok: boolean; error?: string; session?: AgentSession }> {
  const session = (await getSessions())[sessionId]
  if (!session) return { ok: false, error: 'Unknown session.' }
  session.status = 'failed'
  session.result = 'cancelled'
  session.pausedReason = undefined
  session.updatedAt = new Date().toISOString()
  await saveSession(session)
  void chrome.action.setBadgeText({ text: '' })
  void syncSession(session)
  return { ok: true, session }
}
