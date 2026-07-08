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

const resultBadge = (status: string) =>
  status === 'failed' ? 'status-dead' : status === 'submitted' ? 'status-live' : 'status-pending'

/**
 * Launch + live progress. Two explicit paths, no hidden fallbacks:
 * - Test run: fills every form in simulation, submits nothing — safe to preview.
 * - Launch: submits live on platforms verified in the dashboard; unverified
 *   platforms still run in simulation (fail-closed, enforced in background).
 */
function LaunchPanel({ connected, ready }: { connected: boolean; ready: boolean }) {
  const [run, setRun] = useState<RunView | null>(null)
  const [hasContactEmail, setHasContactEmail] = useState(true)

  const refresh = () =>
    chrome.runtime.sendMessage({ type: 'GET_STATE' }, (res) => setRun(res?.state ?? null))

  useEffect(() => {
    refresh()
    const interval = setInterval(refresh, 1000)
    chrome.storage.local.get('founderProfile').then(({ founderProfile }) => {
      setHasContactEmail(Boolean((founderProfile as { contactEmail?: string } | undefined)?.contactEmail))
    })
    return () => clearInterval(interval)
  }, [])

  const launch = (simulated: boolean) =>
    chrome.runtime.sendMessage({ type: 'START_CAMPAIGN', simulated }, () => refresh())
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
  const finished = run?.status === 'done' || run?.status === 'plan_limit' || run?.status === 'sync_error'

  return (
    <div className="site-card" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
      {!running && !waiting && !finished && (
        <>
          <button
            className="btn-primary"
            onClick={() => launch(false)}
            disabled={!connected || !ready}
            title={!ready ? 'Approve your copy first' : 'Submits live on verified platforms; every failure is reported honestly'}
          >
            Launch campaign
          </button>
          <button
            className="btn-ghost"
            onClick={() => launch(true)}
            disabled={!connected || !ready}
            title={!ready ? 'Approve your copy first' : 'Fills every form without submitting — nothing is posted anywhere'}
          >
            Test run (no submissions)
          </button>
          <p className="font-mono-micro">
            Test run previews every platform safely — forms are filled, nothing is submitted.
            Launch submits for real on platforms you’ve verified on the dashboard; everything
            else stays in simulation.
          </p>
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
          {connected && ready && !hasContactEmail && (
            <p className="font-mono-micro" style={{ color: 'var(--amber)' }}>
              Tip: add your contact email in the founder profile above — several platforms
              require one to accept a submission.
            </p>
          )}
        </>
      )}

      {running && (
        <div className="card card--dense site-card">
          <span className="status-running">{run?.simulated ? 'test run' : 'live run'}</span>
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
              <span className={resultBadge(r.status)}>{r.status}</span> {r.platformId}
              {r.simulated ? ' (test)' : ''}
              {r.error ? ` — ${r.error}` : ''}
            </p>
          ))}
        </div>
      )}

      {run?.status === 'done' && run.simulated && (
        <a
          className="font-mono-micro"
          style={{ color: 'var(--primary)' }}
          href={`${DASHBOARD_URL}/platforms`}
          target="_blank"
          rel="noreferrer"
        >
          Test looks good? Enable live mode on the dashboard →
        </a>
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

      {finished && (
        <button className="btn-ghost" onClick={reset}>
          Start another run
        </button>
      )}
    </div>
  )
}

/**
 * Founder profile: auto-filled from the dashboard account (signup data is
 * reused, never re-typed). Local edits always win over remote values, and
 * everything stays editable — adapters only fill what the human approved.
 */
function FounderProfileCard({ connected }: { connected: boolean }) {
  const [founderName, setFounderName] = useState('')
  const [contactEmail, setContactEmail] = useState('')
  const [pricingModel, setPricingModel] = useState('')
  const [tags, setTags] = useState('')
  const [saved, setSaved] = useState(false)
  const [autoFilled, setAutoFilled] = useState(false)

  useEffect(() => {
    let cancelled = false
    chrome.storage.local.get('founderProfile').then(async ({ founderProfile }) => {
      const p =
        (founderProfile as {
          founderName?: string
          contactEmail?: string
          pricingModel?: string
          tags?: string[]
        }) ?? {}

      let name = p.founderName ?? ''
      let email = p.contactEmail ?? ''

      // Incomplete local profile + connected → pull signup data from the dashboard.
      if (connected && (!name || !email)) {
        const remote = await fetchFounderProfile()
        if (remote && !cancelled) {
          name = name || remote.founderName || ''
          email = email || remote.contactEmail || ''
          if (name || email) {
            setAutoFilled(true)
            await chrome.storage.local.set({
              founderProfile: { ...p, founderName: name, contactEmail: email },
            })
          }
        }
      }

      if (cancelled) return
      setFounderName(name)
      setContactEmail(email)
      setPricingModel(p.pricingModel ?? '')
      setTags((p.tags ?? []).join(', '))
    })
    return () => {
      cancelled = true
    }
  }, [connected])

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
      {autoFilled && (
        <p className="font-mono-micro">Auto-filled from your dashboard account — edit anytime.</p>
      )}
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

const CATEGORY_LABELS: Record<string, string> = {
  ai: 'AI tool indexes',
  startup: 'Startup launch platforms',
}

function IndexPopup() {
  const [connected, setConnected] = useState(false)
  const [launched, setLaunched] = useState(false)
  const [site, setSite] = useState<SiteData | null>(null)
  const [originals, setOriginals] = useState<GeneratedCopy[]>([])
  const [drafts, setDrafts] = useState<GeneratedCopy[]>([])
  const [approved, setApproved] = useState(false)
  const [busy, setBusy] = useState<'analyze' | 'generate' | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // Poll connection + run state so the header and step strip stay live while
    // the popup is open (e.g. right after signing in on the dashboard).
    const refreshState = () =>
      chrome.runtime.sendMessage({ type: 'GET_STATE' }, (res) => {
        setConnected(Boolean(res?.connected))
        setLaunched(res?.state?.status === 'done')
      })
    refreshState()
    const interval = setInterval(refreshState, 2_000)

    // Restore an in-progress session so closing the popup never loses work.
    // Approved copy is only restored alongside its site data — the background
    // clears it whenever a different URL is analyzed, so the pair stays in sync.
    chrome.storage.local.get(['siteData', 'approvedCopy']).then(({ siteData, approvedCopy }) => {
      if (siteData) setSite(siteData as SiteData)
      if (siteData && approvedCopy) {
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

  // The in-popup journey, checked off from real state — mirrors the dashboard onboarding.
  const steps = [
    { label: 'Connect', done: connected },
    { label: 'Analyze', done: Boolean(site) },
    { label: 'Approve', done: approved },
    { label: 'Launch', done: launched },
  ]

  return (
    <div className="popup">
      <header className="popup-header">
        <span className="wordmark">usersessions</span>
        <span className={connected ? 'status-live' : 'status-pending'}>
          {connected ? 'connected' : 'not connected'}
        </span>
      </header>

      <div className="steps font-mono-label" aria-label="Progress">
        {steps.map((step, i) => (
          <span key={step.label} style={{ color: step.done ? 'var(--green)' : undefined }}>
            {step.done ? '✓' : `${i + 1}.`} {step.label}
            {i < steps.length - 1 ? ' → ' : ''}
          </span>
        ))}
      </div>

      {!connected && (
        <p className="font-sans-body">
          Sign in on the{' '}
          <a href={DASHBOARD_URL} target="_blank" rel="noreferrer" style={{ color: 'var(--primary)' }}>
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

      <FounderProfileCard connected={connected} />

      <LaunchPanel connected={connected} ready={approved} />

      <AgentPanel connected={connected} ready={approved} />

      <footer className="font-mono-micro popup-footer">Get your product found</footer>
    </div>
  )
}

export default IndexPopup
