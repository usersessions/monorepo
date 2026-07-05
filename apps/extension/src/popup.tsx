import { useEffect, useState } from 'react'
import type { GeneratedCopy, SiteData, TelemetryBatch } from '@usersessions/shared'

import { generateCopy, sendTelemetry } from './brain'

import './style.css'

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
    chrome.runtime.sendMessage({ type: 'GET_STATE' }, (res) => {
      setConnected(Boolean(res?.connected))
    })
    // Restore an in-progress session so closing the popup never loses work.
    chrome.storage.local.get(['siteData', 'approvedCopy']).then(({ siteData, approvedCopy }) => {
      if (siteData) setSite(siteData as SiteData)
      if (approvedCopy) {
        setDrafts(approvedCopy as GeneratedCopy[])
        setApproved(true)
      }
    })
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

  const dashboardUrl = process.env.PLASMO_PUBLIC_DASHBOARD_URL ?? 'https://beta.usersessions.io'

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

      {/* The adapter-driven launch attaches here in M6. Disabled, not hidden — honest state. */}
      <button
        className="btn-ghost"
        disabled
        title="Launching lands with the adapter milestone (M6)"
      >
        Launch campaign
      </button>

      <footer className="font-mono-micro popup-footer">Get your product found</footer>
    </div>
  )
}

export default IndexPopup
