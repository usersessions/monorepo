'use client'

import { useState } from 'react'
import { trackFeature } from '@/lib/tracking'
import type { ReferralGenerateResponse, ReferralProgramCopy, ReferralStructure } from '@usersessions/shared'

const STRUCTURE_LABEL: Record<ReferralStructure, string> = {
  give_get: 'Give-get',
  credits: 'Credits',
  discount: 'Discount',
  cash: 'Cash',
  tiered: 'Tiered',
}

const FIELD_LABEL: Record<keyof ReferralProgramCopy, string> = {
  landingHeadline: 'Landing headline',
  landingBody: 'Landing body',
  landingCta: 'Landing CTA',
  inAppTooltip: 'In-app tooltip',
  inviteEmailSubject: 'Invite email subject',
  inviteEmailBody: 'Invite email body',
  socialPost: 'Social announcement',
}

export function ReferralGenerator({ productId }: { productId: string }) {
  const [category, setCategory] = useState('')
  const [valueProp, setValueProp] = useState('')
  const [pricing, setPricing] = useState('')
  const [structure, setStructure] = useState<ReferralStructure | null>(null)
  const [copy, setCopy] = useState<ReferralProgramCopy | null>(null)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  async function generate() {
    trackFeature('referral_program_generate', 'click', { productId })
    setBusy(true)
    setMsg(null)
    try {
      const res = await fetch('/api/referrals/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId, category, valueProp, pricing }),
      })
      const data = (await res.json()) as ReferralGenerateResponse
      if (!data.ok || !data.copy) {
        setMsg(data.error === 'PLAN_LIMIT_EXCEEDED' ? 'Monthly referral-program limit reached.' : 'Generation failed. Try again.')
      } else {
        setStructure(data.structureType ?? null)
        setCopy(data.copy)
      }
    } catch {
      setMsg('Generation failed. Try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="card flex flex-col" style={{ gap: 'var(--space-md)' }}>
      <input className="input-field" placeholder="Product category (e.g. AI writing tool)" value={category} onChange={(e) => setCategory(e.target.value)} />
      <input className="input-field" placeholder="Value prop (one line)" value={valueProp} onChange={(e) => setValueProp(e.target.value)} />
      <input className="input-field" placeholder="Pricing (e.g. $39/mo subscription, or usage credits)" value={pricing} onChange={(e) => setPricing(e.target.value)} />
      <button className="btn-primary" type="button" onClick={generate} disabled={busy} style={{ width: 'fit-content' }}>
        {busy ? 'Generating…' : 'Generate referral program'}
      </button>

      {structure && (
        <p className="font-mono-micro">Suggested structure: <span style={{ color: 'var(--cyan)' }}>{STRUCTURE_LABEL[structure]}</span></p>
      )}

      {copy &&
        (Object.keys(FIELD_LABEL) as (keyof ReferralProgramCopy)[]).map((field) => (
          <div key={field} className="flex flex-col" style={{ gap: 'var(--space-xs)' }}>
            <div className="flex items-center" style={{ gap: 'var(--space-sm)' }}>
              <span className="font-mono-label" style={{ flex: 1 }}>{FIELD_LABEL[field]}</span>
              <button className="btn-ghost" type="button" onClick={() => void navigator.clipboard.writeText(copy[field])} style={{ fontSize: '0.7rem', padding: '2px 8px' }}>Copy</button>
            </div>
            <textarea
              className="input-field"
              rows={field === 'inviteEmailBody' || field === 'landingBody' ? 4 : 2}
              value={copy[field]}
              onChange={(e) => setCopy((prev) => (prev ? { ...prev, [field]: e.target.value } : prev))}
              aria-label={FIELD_LABEL[field]}
            />
          </div>
        ))}

      {msg && <p className="font-mono-micro">{msg}</p>}
    </div>
  )
}
