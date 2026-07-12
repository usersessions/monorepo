'use client'

import { useState } from 'react'
import type { FounderAuditResponse, FounderAuditResult } from '@usersessions/shared'

const COLOR = (frac: number) =>
  frac >= 0.75 ? 'var(--green)' : frac >= 0.5 ? 'var(--cyan)' : frac >= 0.25 ? 'var(--amber)' : 'var(--red)'

export function FounderAuditRunner({
  productId,
  initialAudit,
}: {
  productId: string
  initialAudit: FounderAuditResult | null
}) {
  const [audit, setAudit] = useState<FounderAuditResult | null>(initialAudit)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [linkedinUrl, setLinkedin] = useState('')
  const [twitterHandle, setTwitter] = useState('')
  const [githubUrl, setGithub] = useState('')
  const [indiehackersUrl, setIndie] = useState('')

  async function run() {
    if (!linkedinUrl && !twitterHandle && !githubUrl && !indiehackersUrl) {
      setError('Add at least one profile to audit.')
      return
    }
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/founder-audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId, linkedinUrl, twitterHandle, githubUrl, indiehackersUrl }),
      })
      const data = (await res.json()) as FounderAuditResponse
      if (!data.ok || !data.audit) {
        setError(
          data.error === 'PLAN_LIMIT_EXCEEDED'
            ? 'You have already run a founder audit recently. Founder is monthly; Pro and Agency are weekly.'
            : 'The audit could not run. Please try again in a minute.'
        )
      } else {
        setAudit(data.audit)
      }
    } catch {
      setError('The audit could not run. Please try again in a minute.')
    } finally {
      setLoading(false)
    }
  }

  function copy(text: string) {
    void navigator.clipboard.writeText(text)
  }

  return (
    <div className="flex flex-col" style={{ gap: 'var(--space-lg)' }}>
      <div className="card flex flex-col" style={{ gap: 'var(--space-sm)' }}>
        <p className="font-mono-label">Your profiles</p>
        <input className="input-field" placeholder="LinkedIn profile URL" value={linkedinUrl} onChange={(e) => setLinkedin(e.target.value)} />
        <input className="input-field" placeholder="X / Twitter handle (without @)" value={twitterHandle} onChange={(e) => setTwitter(e.target.value)} />
        <input className="input-field" placeholder="GitHub profile URL" value={githubUrl} onChange={(e) => setGithub(e.target.value)} />
        <input className="input-field" placeholder="Indie Hackers profile URL" value={indiehackersUrl} onChange={(e) => setIndie(e.target.value)} />
        <button className="btn-primary" type="button" onClick={run} disabled={loading} style={{ width: 'fit-content' }}>
          {loading ? 'Auditing…' : audit ? 'Re-run audit' : 'Run founder audit'}
        </button>
      </div>

      {error && (
        <div className="card card--dense" style={{ borderColor: 'var(--amber)' }}>
          <p className="font-mono-label" style={{ color: 'var(--amber)' }}>{error}</p>
        </div>
      )}

      {audit && (
        <>
          <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-lg)', flexWrap: 'wrap' }}>
            <div>
              <p className="font-mono-label">Founder score</p>
              <p className="font-serif-metric" style={{ fontSize: '3rem', color: COLOR(audit.overallScore / 100) }}>{audit.overallScore}</p>
              <p className="font-mono-micro">out of 100 · {new Date(audit.auditedAt).toISOString().slice(0, 10)}</p>
            </div>
            <div style={{ flex: 1, minWidth: 240 }}>
              <p className="font-mono-label" style={{ color: 'var(--cyan)' }}>Top priority</p>
              <p className="font-sans-body" style={{ color: 'var(--paper)' }}>{audit.topPriority}</p>
            </div>
          </div>

          <div className="card card--dense flex flex-col" style={{ gap: 'var(--space-md)' }}>
            {audit.platforms.map((p) => {
              const frac = p.score / p.max
              return (
                <div key={p.platform} style={{ borderTop: '1px solid var(--border)', paddingTop: 'var(--space-sm)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 'var(--space-sm)' }}>
                    <span className="font-sans-label" style={{ color: 'var(--paper)' }}>{p.label}</span>
                    <span className="font-mono-data" style={{ color: COLOR(frac) }}>{p.score}/{p.max}</span>
                  </div>
                  <div className="meter" style={{ margin: '6px 0' }}>
                    <span style={{ width: `${Math.round(frac * 100)}%`, background: COLOR(frac) }} />
                  </div>
                  <p className="font-mono-micro">{p.feedback}</p>
                  {frac < 0.75 && <p className="font-mono-micro" style={{ color: 'var(--cyan)' }}>→ {p.suggestion}</p>}
                  {p.suggestedCopy && (
                    <div className="flex items-center" style={{ gap: 'var(--space-sm)', marginTop: 'var(--space-xs)' }}>
                      <span className="font-mono-micro" style={{ flex: 1, color: 'var(--muted-2)' }}>“{p.suggestedCopy}”</span>
                      <button className="btn-ghost" type="button" onClick={() => copy(p.suggestedCopy)} style={{ fontSize: '0.7rem', padding: '2px 8px' }}>Copy</button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
