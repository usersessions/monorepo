import { useEffect, useState } from 'react'
import type { PlatformResult, Surface } from '@usersessions/shared'

import './style.css'

const DASHBOARD_URL = process.env.PLASMO_PUBLIC_DASHBOARD_URL ?? 'https://usersessions.io'

/**
 * MINIMAL action launcher (refactor): the dashboard owns analytics, audits, copy and campaign
 * management — the popup only fires the two browser-context actions and shows a status badge.
 * Everything heavy (copy preview, analytics, logs, billing) now lives on the dashboard.
 */

interface RunView {
  status: string
  simulated: boolean
  queue: string[]
  results: PlatformResult[]
}

interface SurfaceEntry {
  surface: Surface
  unlocked: boolean
}

function IndexPopup() {
  const [connected, setConnected] = useState(false)
  const [run, setRun] = useState<RunView | null>(null)
  const [ready, setReady] = useState(false) // a product page has been analyzed
  const [view, setView] = useState<'home' | 'surfaces'>('home')
  const [surfaces, setSurfaces] = useState<SurfaceEntry[] | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)

  const refresh = () =>
    chrome.runtime.sendMessage({ type: 'GET_STATE' }, (res) => {
      setRun(res?.state ?? null)
      setConnected(Boolean(res?.connected))
    })

  useEffect(() => {
    refresh()
    const interval = setInterval(refresh, 1500)
    chrome.storage.local.get('siteData').then(({ siteData }) => setReady(Boolean(siteData?.title)))
    return () => clearInterval(interval)
  }, [])

  const analyze = () => {
    setBusy('analyze')
    setMsg(null)
    chrome.runtime.sendMessage({ type: 'EXTRACT_ACTIVE_TAB' }, (res) => {
      setBusy(null)
      if (res?.ok) {
        setReady(true)
        setMsg('Product detected. You can launch now.')
      } else setMsg(res?.error ?? 'Could not read this page.')
    })
  }

  const launch = () => {
    setBusy('launch')
    chrome.runtime.sendMessage({ type: 'START_CAMPAIGN', simulated: false }, () => {
      setBusy(null)
      refresh()
    })
  }

  const openSurfaces = () => {
    setView('surfaces')
    if (!surfaces) chrome.runtime.sendMessage({ type: 'GET_SURFACES' }, (res) => setSurfaces(res?.surfaces ?? []))
  }

  const distribute = (e: SurfaceEntry) => {
    setBusy(e.surface.id)
    setMsg(null)
    const type = e.surface.submissionType === 'tracked_only' ? 'VERIFY_SURFACE' : 'DISTRIBUTE_SURFACE'
    chrome.runtime.sendMessage(
      { type, surfaceId: e.surface.id, surfaceName: e.surface.name, url: e.surface.urlPattern },
      (res) => {
        setBusy(null)
        setMsg(res?.ok ? `Opened ${e.surface.name}.` : res?.error ?? 'Could not open that surface.')
      }
    )
  }

  const status = run?.status ?? 'idle'
  const statusClass =
    status === 'running' || status === 'awaiting_user_action'
      ? 'status-running'
      : status === 'done'
        ? 'status-live'
        : status === 'sync_error' || status === 'plan_limit'
          ? 'status-dead'
          : 'status-pending'

  return (
    <div className="popup">
      <header className="popup-header">
        <span className="wordmark">usersessions</span>
        <span className={connected ? 'status-live' : 'status-pending'}>{connected ? 'connected' : 'not connected'}</span>
      </header>

      {!connected ? (
        <p className="font-sans-body">
          Sign in on the{' '}
          <a href={DASHBOARD_URL} target="_blank" rel="noreferrer" style={{ color: 'var(--primary)' }}>dashboard</a>{' '}
          and keep the tab open to connect.
        </p>
      ) : view === 'surfaces' ? (
        <>
          <button className="btn-ghost" onClick={() => setView('home')}>← Back</button>
          {surfaces === null ? (
            <p className="font-mono-micro">Loading surfaces…</p>
          ) : (
            surfaces.map((e) => (
              <div key={e.surface.id} className="card card--dense site-card" style={{ opacity: e.unlocked ? 1 : 0.5 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span className="font-mono-data" style={{ flex: 1 }}>{e.surface.name}</span>
                </div>
                {e.unlocked ? (
                  <button className="btn-ghost" onClick={() => distribute(e)} disabled={busy !== null || !ready}>
                    {busy === e.surface.id ? 'Opening…' : e.surface.submissionType === 'tracked_only' ? 'Open & verify' : 'Draft & open'}
                  </button>
                ) : (
                  <span className="font-mono-micro" style={{ color: 'var(--amber)' }}>Locked on your plan</span>
                )}
              </div>
            ))
          )}
        </>
      ) : (
        <>
          {!ready && (
            <button className="btn-ghost" onClick={analyze} disabled={busy !== null}>
              {busy === 'analyze' ? 'Reading page…' : 'Analyze this page'}
            </button>
          )}
          <button className="btn-primary" onClick={launch} disabled={!ready || busy !== null || status === 'running'}>
            Launch directories
          </button>
          <button className="btn-ghost" onClick={openSurfaces} disabled={!ready}>
            Distribute to surfaces
          </button>

          {status !== 'idle' && (
            <div className="card card--dense site-card" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span className={statusClass}>{status.replace(/_/g, ' ')}</span>
              {run && status === 'running' && <span className="font-mono-micro">{run.queue.length} left</span>}
            </div>
          )}

          <a className="font-mono-micro" href={`${DASHBOARD_URL}/settings`} target="_blank" rel="noreferrer" style={{ color: 'var(--muted)' }}>
            Settings & analytics on the dashboard →
          </a>
        </>
      )}

      {msg && <p className="font-mono-micro">{msg}</p>}
      <footer className="font-mono-micro popup-footer">Get your product found</footer>
    </div>
  )
}

export default IndexPopup
