'use client'

import { useState } from 'react'
import type { AuditResponse, LandingPageAuditResult } from '@usersessions/shared'

const COLOR = (frac: number) =>
  frac >= 0.75 ? 'var(--green)' : frac >= 0.5 ? 'var(--cyan)' : frac >= 0.25 ? 'var(--amber)' : 'var(--red)'

export function AuditRunner({
  productId,
  url,
  initialAudit,
}: {
  productId: string
  url: string
  initialAudit: LandingPageAuditResult | null
}) {
  const [audit, setAudit] = useState<LandingPageAuditResult | null>(initialAudit)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function run() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId, url }),
      })
      const data = (await res.json()) as AuditResponse
      if (!data.ok || !data.audit) {
        setError(
          data.error === 'PLAN_LIMIT_EXCEEDED'
            ? 'You have already run an audit recently. Free and Founder plans get one per week; Pro and Agency get one per day.'
            : data.error === 'FETCH_FAILED'
              ? 'We could not reach that URL. Check it loads publicly, then try again.'
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

  return (
    <div className="flex flex-col" style={{ gap: 'var(--space-lg)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 'var(--space-sm)' }}>
        <p className="font-mono-micro">{url}</p>
        <button className="btn-primary" type="button" onClick={run} disabled={loading}>
          {loading ? 'Auditing…' : audit ? 'Re-run audit' : 'Run audit'}
        </button>
      </div>

      {error && (
        <div className="card card--dense" style={{ borderColor: 'var(--amber)' }}>
          <p className="font-mono-label" style={{ color: 'var(--amber)' }}>{error}</p>
        </div>
      )}

      {!audit ? (
        <div className="card">
          <p className="font-sans-body">
            No audit yet. Run one to see how clearly AI assistants can understand and recommend your
            product — every result is computed from your live page, never estimated.
          </p>
        </div>
      ) : (
        <>
          <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-lg)', flexWrap: 'wrap' }}>
            <div>
              <p className="font-mono-label">AIO Score</p>
              <p className="font-serif-metric" style={{ fontSize: '3rem', color: COLOR(audit.overallScore / 100) }}>
                {audit.overallScore}
              </p>
              <p className="font-mono-micro">out of 100 · {new Date(audit.auditedAt).toISOString().slice(0, 10)}</p>
            </div>
            <div style={{ flex: 1, minWidth: 240 }}>
              <p className="font-mono-label" style={{ color: 'var(--cyan)' }}>Top priority</p>
              <p className="font-sans-body" style={{ color: 'var(--paper)' }}>{audit.topPriority}</p>
            </div>
          </div>

          <div className="card card--dense flex flex-col" style={{ gap: 'var(--space-md)' }}>
            {audit.categories.map((c) => {
              const frac = c.score / c.max
              return (
                <div key={c.name} style={{ borderTop: '1px solid var(--border)', paddingTop: 'var(--space-sm)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 'var(--space-sm)' }}>
                    <span className="font-sans-label" style={{ color: 'var(--paper)' }}>{c.label}</span>
                    <span className="font-mono-data" style={{ color: COLOR(frac) }}>{c.score}/{c.max}</span>
                  </div>
                  <div className="meter" style={{ margin: '6px 0' }}>
                    <span style={{ width: `${Math.round(frac * 100)}%`, background: COLOR(frac) }} />
                  </div>
                  <p className="font-mono-micro">{c.feedback}</p>
                  {frac < 0.75 && (
                    <p className="font-mono-micro" style={{ color: 'var(--cyan)' }}>→ {c.suggestion}</p>
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
