'use client'

import { useState } from 'react'
import { trackFeature } from '@/lib/tracking'
import type { ReviewCampaignResponse } from '@usersessions/shared'

type Draft = NonNullable<ReviewCampaignResponse['drafts']>[number]

/**
 * 4-step review-request builder: paste/CSV recipients → pick platform → AI drafts
 * per-recipient emails → founder edits → approve & send. Nothing sends without review.
 */
export function ReviewCampaignBuilder({
  products,
  platforms,
  perCampaign,
}: {
  products: { id: string; name: string }[]
  platforms: { id: string; name: string }[]
  perCampaign: number
}) {
  const [productId, setProductId] = useState(products[0]?.id ?? '')
  const [platformId, setPlatformId] = useState(platforms[0]?.id ?? '')
  const [raw, setRaw] = useState('')
  const [drafts, setDrafts] = useState<Draft[]>([])
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  // Parse "email, name, activation event" per line (name + event optional).
  function parse() {
    return raw
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)
      .map((l) => {
        const [email, name, activationEvent] = l.split(',').map((p) => p.trim())
        return { email, name: name || undefined, activationEvent: activationEvent || undefined }
      })
      .filter((r) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(r.email))
  }

  async function generate() {
    const recipients = parse()
    if (recipients.length === 0) {
      setMsg('Add at least one line as: email, name, what they did')
      return
    }
    trackFeature('review_campaign_create', 'click', { productId })
    setBusy(true)
    setMsg(null)
    try {
      const res = await fetch('/api/reviews/campaign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId, platformId, recipients }),
      })
      const data = (await res.json()) as ReviewCampaignResponse
      if (!data.ok || !data.drafts) {
        setMsg(
          data.error === 'PLAN_LIMIT_EXCEEDED'
            ? 'You have hit your review-campaign limit for this month.'
            : 'Could not generate the campaign. Try again.'
        )
      } else {
        setDrafts(data.drafts)
        setMsg(`Drafted ${data.drafts.length} emails — edit each, then approve & send.`)
      }
    } catch {
      setMsg('Could not generate the campaign. Try again.')
    } finally {
      setBusy(false)
    }
  }

  function editDraft(i: number, field: 'subject' | 'body', value: string) {
    setDrafts((prev) => prev.map((d, idx) => (idx === i ? { ...d, [field]: value } : d)))
  }

  async function send() {
    trackFeature('review_request_send', 'submit', { productId })
    setBusy(true)
    setMsg(null)
    try {
      const res = await fetch('/api/reviews/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requests: drafts.map((d) => ({ requestId: d.requestId, subject: d.subject, body: d.body })),
        }),
      })
      const data = await res.json()
      setMsg(data.ok ? `Sent ${data.sent} review requests.` : 'Send failed. Try again.')
      if (data.ok) setDrafts([])
    } catch {
      setMsg('Send failed. Try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="card flex flex-col" style={{ gap: 'var(--space-md)' }}>
      <p className="font-mono-label">Start a review campaign</p>
      <div className="flex" style={{ gap: 'var(--space-sm)', flexWrap: 'wrap' }}>
        <select className="input-field" style={{ width: 'auto' }} value={productId} onChange={(e) => setProductId(e.target.value)} aria-label="Product">
          {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <select className="input-field" style={{ width: 'auto' }} value={platformId} onChange={(e) => setPlatformId(e.target.value)} aria-label="Review platform">
          {platforms.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>

      <label className="font-mono-micro">Activated users — one per line: <code>email, name, what they did</code> (up to {perCampaign})</label>
      <textarea
        className="input-field"
        rows={5}
        value={raw}
        onChange={(e) => setRaw(e.target.value)}
        placeholder={'ada@example.com, Ada, published her first post\nlin@example.com, Lin, connected an integration'}
      />

      {drafts.length === 0 ? (
        <button className="btn-primary" type="button" onClick={generate} disabled={busy} style={{ width: 'fit-content' }}>
          {busy ? 'Drafting…' : 'Generate request emails'}
        </button>
      ) : (
        <>
          {drafts.map((d, i) => (
            <div key={d.requestId} className="card card--dense flex flex-col" style={{ gap: 'var(--space-xs)' }}>
              <span className="font-mono-micro">{d.recipientEmail}</span>
              <input className="input-field" value={d.subject} onChange={(e) => editDraft(i, 'subject', e.target.value)} aria-label="Subject" />
              <textarea className="input-field" rows={4} value={d.body} onChange={(e) => editDraft(i, 'body', e.target.value)} aria-label="Body" />
            </div>
          ))}
          <button className="btn-primary" type="button" onClick={send} disabled={busy} style={{ width: 'fit-content' }}>
            {busy ? 'Sending…' : `Approve & send ${drafts.length}`}
          </button>
        </>
      )}

      {msg && <p className="font-mono-micro">{msg}</p>}
    </div>
  )
}
