import { useEffect, useState } from 'react'
import type { SiteData } from '@usersessions/shared'

import './style.css'

const STEPS = ['Install', 'Launch', 'Watch'] as const // verbatim plan — BUILD_SPEC §2

function IndexPopup() {
  const [connected, setConnected] = useState(false)
  const [site, setSite] = useState<SiteData | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    chrome.runtime.sendMessage({ type: 'GET_STATE' }, (res) => {
      setConnected(Boolean(res?.connected))
    })
  }, [])

  const analyze = () => {
    setBusy(true)
    setError(null)
    chrome.runtime.sendMessage({ type: 'EXTRACT_ACTIVE_TAB' }, (res) => {
      setBusy(false)
      if (res?.ok) setSite(res.data as SiteData)
      else setError(res?.error ?? 'Could not read this page.')
    })
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

      <button className="btn-primary" onClick={analyze} disabled={busy}>
        {busy ? 'Reading page…' : 'Analyze this page'}
      </button>

      {error && (
        <p className="font-mono-micro" style={{ color: 'var(--red)' }}>
          {error}
        </p>
      )}

      {site && (
        <div className="card card--dense site-card">
          <p className="font-mono-label">Detected product</p>
          <p className="font-mono-data">{site.title || '(no title found)'}</p>
          {site.description && <p className="font-mono-micro">{site.description}</p>}
          {site.keywords.length > 0 && (
            <p className="font-mono-micro">keywords: {site.keywords.join(', ')}</p>
          )}
        </div>
      )}

      {/* Copy generation (M5) and the adapter-driven launch (M6) attach here. Disabled, not hidden — honest state. */}
      <button className="btn-ghost" disabled title="Launching lands with the adapter milestone (M6)">
        Launch campaign
      </button>

      <footer className="font-mono-micro popup-footer">Get your product found</footer>
    </div>
  )
}

export default IndexPopup
