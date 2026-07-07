import { useEffect, useState } from 'react'
import type { AgentSession } from '@usersessions/shared'

import { ADAPTERS } from '../adapters/registry'

/**
 * Agent control panel — start/monitor/resume/abort agent sessions from the popup.
 * Live mode stays fail-closed behind per-platform verification (enforced in the
 * orchestrator); unverified platforms run in simulation with submit skipped.
 */
export function AgentPanel({ connected, ready }: { connected: boolean; ready: boolean }) {
  const [sessions, setSessions] = useState<AgentSession[]>([])
  const [platformId, setPlatformId] = useState(ADAPTERS[0]?.platformId ?? '')
  const [error, setError] = useState<string | null>(null)

  const refresh = () =>
    chrome.runtime.sendMessage({ type: 'GET_AGENT_SESSIONS' }, (res) => setSessions(res?.sessions ?? []))

  useEffect(() => {
    refresh()
    const interval = setInterval(refresh, 1_000)
    return () => clearInterval(interval)
  }, [])

  const start = () => {
    setError(null)
    chrome.runtime.sendMessage({ type: 'START_AGENT', platformId }, (res) => {
      if (!res?.ok) setError(res?.error ?? 'Could not start the agent.')
      refresh()
    })
  }
  const resume = (id: string) => chrome.runtime.sendMessage({ type: 'RESUME_AGENT', sessionId: id }, () => refresh())
  const abort = (id: string) => chrome.runtime.sendMessage({ type: 'ABORT_AGENT', sessionId: id }, () => refresh())

  const active = sessions.find((s) => s.status === 'running' || s.status === 'paused')
  const recent = sessions.filter((s) => s.id !== active?.id).slice(0, 5)
  const dashboardUrl = process.env.PLASMO_PUBLIC_DASHBOARD_URL ?? 'https://usersessions.io'
  const total = Math.max(active?.totalSteps ?? 1, 1)

  return (
    <div className="site-card" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
      <p className="font-mono-label">Agent — computer use</p>

      {!active && (
        <>
          <select
            className="input-field"
            value={platformId}
            onChange={(e) => setPlatformId(e.target.value)}
            aria-label="Platform to run the agent on"
          >
            {ADAPTERS.map((a) => (
              <option key={a.platformId} value={a.platformId}>
                {a.platformId}
              </option>
            ))}
          </select>
          <button className="btn-primary" onClick={start} disabled={!connected || !ready}>
            Run agent on this platform
          </button>
          {(!connected || !ready) && (
            <p className="font-mono-micro">Connect on the dashboard and approve your copy first.</p>
          )}
        </>
      )}

      {active && (
        <div className="card card--dense site-card">
          <span className={active.status === 'paused' ? 'status-pending' : 'status-running'}>{active.status}</span>
          <p className="font-mono-micro">
            {active.platformId} · step {Math.min(active.currentStep + 1, total)} of {total}
            {active.simulated ? ' · simulation' : ' · live'}
          </p>
          <div
            role="progressbar"
            aria-valuenow={Math.min(100, Math.round((active.currentStep / total) * 100))}
            aria-valuemin={0}
            aria-valuemax={100}
            style={{ background: 'rgba(127,127,127,0.25)', height: 6, borderRadius: 3 }}
          >
            <div
              style={{
                width: `${Math.min(100, Math.round((active.currentStep / total) * 100))}%`,
                background: 'var(--primary)',
                height: 6,
                borderRadius: 3,
              }}
            />
          </div>
          {active.status === 'paused' && (
            <>
              <p className="font-mono-micro" style={{ color: 'var(--amber)' }}>
                {active.pausedReason}
              </p>
              <button className="btn-primary" onClick={() => resume(active.id)}>
                I’ve done it — resume
              </button>
            </>
          )}
          <button className="btn-ghost" onClick={() => abort(active.id)}>
            Abort session
          </button>
        </div>
      )}

      {recent.length > 0 && (
        <div className="card card--dense site-card">
          {recent.map((s) => (
            <p key={s.id} className="font-mono-micro">
              <span
                className={
                  s.status === 'completed' ? 'status-live' : s.status === 'failed' ? 'status-dead' : 'status-pending'
                }
              >
                {s.status}
              </span>{' '}
              {s.platformId}
              {s.result ? ` — ${s.result}` : ''}
              {s.simulated ? ' (simulation)' : ''}
            </p>
          ))}
          <a
            className="font-mono-micro"
            href={`${dashboardUrl}/agent`}
            target="_blank"
            rel="noreferrer"
            style={{ color: 'var(--primary)' }}
          >
            Open agent monitor →
          </a>
        </div>
      )}

      {error && (
        <p className="font-mono-micro" style={{ color: 'var(--red)' }}>
          {error}
        </p>
      )}
    </div>
  )
}
