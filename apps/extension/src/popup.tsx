import { useEffect, useState } from 'react'
import type { GeneratedCopy, PlatformResult, SiteData, TelemetryBatch } from '@usersessions/shared'

import { generateCopy, sendTelemetry } from './brain'
import { fetchFounderProfile } from './api'
import { AgentPanel } from './agent/AgentPanel'

import './style.css'

const DASHBOARD_URL = process.env.PLASMO_PUBLIC_DASHBOARD_URL ?? 'https://usersessions.io'

interface RunView {
  status: string
  simulated: boolean
  queue: string[]
  currentPlatform?: string
  pending?: { platformId: string; message: string; reason: string; needsInput: boolean }
  results: PlatformResult[]
}

/** Launch + live progress. Live mode stays locked until adapters are verified (M6 gate, enforced in background). */
function LaunchPanel({ connected, ready }: { connected: boolean; ready: boolean }) {
  const [run, setRun] = useState<RunView | null>(null)

  const refresh = () =>
    chrome.runtime.sendMessage({ type: 'GET_STATE' }, (res) => setRun(res?.state ?? null))

  useEffect(() => {
    refresh()
    const interval = setInterval(refresh, 1000)
    return () => clearInterval(interval)
  }, [])

  const launch = () =>
    // Request live mode; the background falls back to simulation only if any adapter is unverified.
    chrome.runtime.sendMessage({ type: 'START_CAMPAIGN', simulated: false }, () => refresh())
  const reset = () => chrome.runtime.sendMessage({ type: 'RESET_CAMPAIGN' }, () => refresh())
  const retrySync = () => chrome.runtime.sendMessage({ type: 'RETRY_SYNC' }, () => refresh())

  const [userInput, setUserInput] = useState('')
  const resumeAction = () =>
    chrome.runtime.sendMessage({ type: 'RESUME_USER_ACTION', userInput }, () => {
      setUserInput('')
      refresh()
    })
  const skipAction = () => chrome.runtime.sendMessage({ type: 'SKIP_USER_ACTION' }, () => refresh())

  const running = run?.status === 'running' || run?.status === 'paused'
  const waiting = run?.status === 'awaiting_user_action'

  return (
    <div className="site-card" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
      {!running && !waiting && run?.status !== 'done' && run?.status !== 'plan_limit' && run?.status !== 'sync_error' && (
        <>
          <button
            className="btn-primary"
            onClick={launch}
            disabled={!connected || !ready}
            title={!ready ? 'Approve your copy first' : 'Submits live; failures are reported per platform'}
          >
            Launch campaign
          </button>
          {!connected && (
            <p className="font-mono-micro" style={{ color: 'var(--amber)' }}>
              Connect first — sign in on the dashboard and keep the tab open.
            </p>
          )}
          {connected && !ready && (
            <p className="font-mono-micro">
              Generate and approve your listing copy above — Launch unlocks after approval.
            </p>
          )}
        </>
      )}

      {running && (
        <div className="card card--dense site-card">
          <span className="status-running">running</span>
          <p className="font-mono-micro">
            {run?.currentPlatform ? `submitting: ${run.currentPlatform}` : 'pacing…'}
            {' · '}
            {run?.queue.length ?? 0} remaining
          </p>
        </div>
      )}

      {/* Human hand-off: CAPTCHA / OTP / email confirmation — the extension paused, you finish this bit. */}
      {waiting && run?.pending && (
        <div className="card card--dense site-card">
          <span className="status-pending">needs you</span>
          <p className="font-mono-micro">
            {run.pending.platformId}: {run.pending.message}
          </p>
          {run.pending.needsInput && (
            <input
              className="input-field"
              value={userInput}
              onChange={(e) => setUserInput(e.target.value)}
              placeholder="Paste the code from your email"
              aria-label="Verification code"
            />
          )}
          <button className="btn-primary" onClick={resumeAction}>
            Done — continue
          </button>
          <button className="btn-ghost" onClick={skipAction}>
            Skip this platform
          </button>
        </div>
      )}

      {(run?.results.length ?? 0) > 0 && (
        <div className="card card--dense site-card">
          {run!.results.map((r) => (
            <p key={r.platformId} className="font-mono-micro">
              <span className={r.status === 'failed' ? 'status-dead' : 'status-pending'}>{r.status}</span>{' '}
              {r.platformId}
              {r.error ? ` — ${r.error}` : ''}
            </p>
          ))}
        </div>
      )}

      {run?.status === 'plan_limit' && (
        <p className="font-mono-micro" style={{ color: 'var(--amber)' }}>
          Plan limit reached — upgrade on the dashboard to keep launching.
        </p>
      )}

      {run?.status === 'sync_error' && (
        <>
          <p className="font-mono-micro" style={{ color: 'var(--amber)' }}>
            Run finished but has not synced to your dashboard yet — no results were lost. Open the
            dashboard while signed in, or retry now.
          </p>
          <button className="btn-ghost" onClick={retrySync}>
            Retry sync
          </button>
        </>
      )}

      {(run?.status === 'done' || run?.status === 'plan_limit' || run?.status === 'sync_error') && (
        <button className="btn-ghost" onClick={reset}>
          Start another run
        </button>
      )}
    </div>
  )
}

/** Founder profile: human-provided data adapters may fill into forms — never invented. */
function FounderProfileCard() {
  const [founderName, setFounderName] = useState('')
  const [contactEmail, setContactEmail] = useState('')
  const [pricingModel, setPricingModel] = useState('')
  const [tags, setTags] = useState('')
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    chrome.storage.local.get('founderProfile').then(({ founderProfile }) => {
      const p =
        (founderProfile as {
          founderName?: string
          contactEmail?: string
          pricingModel?: string
          tags?: string[]
        }) ?? {}
      setFounderName(p.founderName ?? '')
      setContactEmail(p.contactEmail ?? '')
      setPricingModel(p.pricingModel ?? '')
      setTags((p.tags ?? []).join(', '))
    })
  }, [])

  const save = async () => {
    await chrome.storage.local.set({
      founderProfile: {
        founderName: founderName.trim(),
        contactEmail: contactEmail.trim(),
        pricingModel,
        tags: tags.split(',').map((t) => t.trim()).filter(Boolean),
      },
    })
    setSaved(true)
    setTimeout(() => setSaved(false), 2_000)
  }

  return (
    <div className="card card--dense site-card">
      <p className="font-mono-label">Founder profile — used to fill submission forms</p>
      <input
        className="input-field"
        value={founderName}
        onChange={(e) => { setFounderName(e.target.value); setSaved(false) }}
        placeholder="Your name"
        aria-label="Founder name"
      />
      <input
        className="input-field"
        type="email"
        value={contactEmail}
        onChange={(e) => { setContactEmail(e.target.value); setSaved(false) }}
        placeholder="Contact email"
        aria-label="Contact email"
      />
      <select
        className="input-field"
        value={pricingModel}
        onChange={(e) => { setPricingModel(e.target.value); setSaved(false) }}
        aria-label="Pricing model"
      >
        <option value="">Pricing model…</option>
        <option value="free">Free</option>
        <option value="freemium">Freemium</option>
        <option value="paid">Paid</option>
        <option value="free trial">Free trial</option>
        <option value="open source">Open source</option>
      </select>
      <input
        className="input-field"
        value={tags}
        onChange={(e) => { setTags(e.target.value); setSaved(false) }}
        placeholder="Tags, comma-separated (overrides detected keywords)"
        aria-label="Tags"
      />
      <button className="btn-ghost" onClick={save}>
        {saved ? 'Saved ✓' : 'Save profile'}
      </button>
    </div>
  )
}

const STEPS = ['Install', 'Launch', 'Watch'] as const // verbatim plan — BUILD_SPEC §2
const CATEGORY_LABELS: Record<string, string> = {
  ai: 'AI tool indexes',
  startup: 'Startup launch platforms',
}

function IndexPopup() {
  const [connected, setConnected] = useState(false)
  const [site, setSite] = useState<SiteData | null>(null)
  const [originals, setOriginals] = useState<GeneratedCopy[]>([])
  const [drafts, setDrafts] = useState<GeneratedCopy[]>([])
  const [approved, setApproved] = useState(false)
  const [busy, setBusy] = useState<'analyze' | 'generate' | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // Poll connection state so the header flips to 'connected' live while the
    // popup is open (e.g. right after signing in on the dashboard in another tab).
    const refreshConnected = () =>
      chrome.runtime.sendMessage({ type: 'GET_STATE' }, (res) => {
        setConnected(Boolean(res?.connected))
      })
    refreshConnected()
    const interval = setInterval(refreshConnected, 2_000)

    // Restore an in-progress session so closing the popup never loses work.
    chrome.storage.local.get(['siteData', 'approvedCopy']).then(({ siteData, approvedCopy }) => {
      if (siteData) setSite(siteData as SiteData)
      if (approvedCopy) {
        setDrafts(approvedCopy as GeneratedCopy[])
        setApproved(true)
      }
    })

    return () => clearInterval(interval)
  }, [])

  const analyze = () => {
    setBusy('analyze')
    setError(null)
    setApproved(false)
    chrome.runtime.sendMessage({ type: 'EXTRACT_ACTIVE_TAB' }, (res) => {
      setBusy(null)
      if (res?.ok) {
        setSite(res.data as SiteData)
        setOriginals([])
        setDrafts([])
      } else {
        setError(res?.error ?? 'Could not read this page.')
      }
    })
  }

  const generate = async () => {
    if (!site) return
    setBusy('generate')
    setError(null)
    try {
      const { copy } = await generateCopy(site)
      setOriginals(copy)
      setDrafts(copy.map((c) => ({ ...c }))) // independent editable drafts
      setApproved(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Copy generation failed.')
    } finally {
      setBusy(null)
    }
  }

  const editDraft = (index: number, field: 'hook' | 'body', value: string) => {
    setDrafts((prev) => prev.map((d, i) => (i === index ? { ...d, [field]: value } : d)))
    setApproved(false)
  }

  const approve = async () => {
    // Persist the approved copy for the launch flow (M6) and record edit telemetry.
    await chrome.storage.local.set({ approvedCopy: drafts })
    setApproved(true)

    const batch: TelemetryBatch = {
      entries: drafts.map((d, i) => {
        const o = originals[i]
        const wasEdited = !o || o.hook !== d.hook || o.body !== d.body
        return {
          platformCategory: d.category,
          originalHook: o?.hook,
          editedHook: wasEdited ? d.hook : undefined,
          originalBody: o?.body,
          editedBody: wasEdited ? d.body : undefined,
          wasEdited,
        }
      }),
    }
    void sendTelemetry(batch)
  }

  const dashboardUrl = process.env.PLASMO_PUBLIC_DASHBOARD_URL ?? 'https://usersessions.io'

  return (
    <div className="popup">
      <header className="popup-header">
        <span className="wordmark">usersessions</span>
        <span className={connected ? 'status-live' : 'status-pending'}>
          {connected ? 'connected' : 'not connected'}
        </span>
      </header>

      <div className="steps font-mono-label">
        {STEPS.map((step, i) => (
          <span key={step}>
            {i + 1}. {step}
            {i < STEPS.length - 1 ? ' → ' : ''}
          </span>
        ))}
      </div>

      {!connected && (
        <p className="font-sans-body">
          Sign in on the{' '}
          <a href={dashboardUrl} target="_blank" rel="noreferrer" style={{ color: 'var(--primary)' }}>
            dashboard
          </a>{' '}
          to connect this extension.
        </p>
      )}

      <button className="btn-primary" onClick={analyze} disabled={busy !== null}>
        {busy === 'analyze' ? 'Reading page…' : 'Analyze this page'}
      </button>

      {site && (
        <div className="card card--dense site-card">
          <p className="font-mono-label">Detected product</p>
          <p className="font-mono-data">{site.title || '(no title found)'}</p>
          {site.description && <p className="font-mono-micro">{site.description}</p>}
        </div>
      )}

      {site && drafts.length === 0 && (
        <button className="btn-ghost" onClick={generate} disabled={busy !== null || !connected}>
          {busy === 'generate' ? 'Writing copy…' : 'Generate listing copy'}
        </button>
      )}

      {/* Creative-director approval: every word visible and editable BEFORE anything is submitted. */}
      {drafts.map((draft, i) => (
        <div key={draft.category} className="card card--dense site-card">
          <p className="font-mono-label">{CATEGORY_LABELS[draft.category] ?? draft.category}</p>
          <input
            className="input-field"
            value={draft.hook}
            maxLength={80}
            onChange={(e) => editDraft(i, 'hook', e.target.value)}
            aria-label={`${draft.category} hook`}
          />
          <textarea
            className="input-field"
            value={draft.body}
            maxLength={600}
            rows={4}
            onChange={(e) => editDraft(i, 'body', e.target.value)}
            aria-label={`${draft.category} body`}
          />
        </div>
      ))}

      {drafts.length > 0 && (
        <button className="btn-primary" onClick={approve} disabled={approved}>
          {approved ? 'Copy approved ✓' : 'Approve copy'}
        </button>
      )}

      {error && (
        <p className="font-mono-micro" style={{ color: 'var(--red)' }}>
          {error}
        </p>
      )}

      <FounderProfileCard />

      <LaunchPanel connected={connected} ready={approved} />

      <AgentPanel connected={connected} ready={approved} />

      <footer className="font-mono-micro popup-footer">Get your product found</footer>
    </div>
  )
}

export default IndexPopup
