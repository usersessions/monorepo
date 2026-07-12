'use client'

import { useState } from 'react'
import type { CommunityOpportunity, CommunityRespondResponse, CommunitySurface } from '@usersessions/shared'

const SURFACES: { value: CommunitySurface; label: string }[] = [
  { value: 'indiehackers', label: 'Indie Hackers' },
  { value: 'stackoverflow', label: 'Stack Overflow' },
  { value: 'hackernews', label: 'Hacker News' },
  { value: 'linkedin', label: 'LinkedIn' },
  { value: 'other', label: 'Other' },
]

const SURFACE_LABEL: Record<string, string> = Object.fromEntries(SURFACES.map((s) => [s.value, s.label]))

export function CommunityFeed({
  productId,
  initialOpportunities,
}: {
  productId: string
  initialOpportunities: CommunityOpportunity[]
}) {
  const [opps, setOpps] = useState<CommunityOpportunity[]>(initialOpportunities)
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)

  // Add-opportunity form
  const [surface, setSurface] = useState<CommunitySurface>('indiehackers')
  const [url, setUrl] = useState('')
  const [title, setTitle] = useState('')

  async function addOpportunity() {
    if (!url || !title) {
      setMsg('Add a URL and title.')
      return
    }
    setBusy('add')
    try {
      const res = await fetch('/api/communities/opportunities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId, surface, url, title }),
      })
      const data = await res.json()
      if (data.ok) {
        setOpps((prev) => [
          { id: data.id, surface, url, title, contentSnippet: null, relevanceScore: 50, status: 'new', createdAt: new Date().toISOString() },
          ...prev,
        ])
        setUrl('')
        setTitle('')
        setMsg(null)
      } else setMsg('Could not add.')
    } finally {
      setBusy(null)
    }
  }

  async function draft(id: string) {
    setBusy(id)
    setMsg(null)
    try {
      const res = await fetch('/api/communities/respond', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ opportunityId: id }),
      })
      const data = (await res.json()) as CommunityRespondResponse
      if (data.ok && data.draftResponse) {
        setDrafts((prev) => ({ ...prev, [id]: data.draftResponse! }))
        setOpps((prev) => prev.map((o) => (o.id === id ? { ...o, status: 'approved' } : o)))
      } else {
        setMsg(data.error === 'PLAN_LIMIT_EXCEEDED' ? 'Monthly response limit reached.' : 'Draft failed.')
      }
    } finally {
      setBusy(null)
    }
  }

  async function markPosted(id: string) {
    const finalResponse = drafts[id] ?? ''
    setBusy(id)
    try {
      await fetch('/api/communities/respond', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ opportunityId: id, finalResponse, posted: true }),
      })
      setOpps((prev) => prev.map((o) => (o.id === id ? { ...o, status: 'responded' } : o)))
      setMsg('Marked as responded.')
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="flex flex-col" style={{ gap: 'var(--space-lg)' }}>
      {/* Add opportunity (manual curation) */}
      <div className="card flex flex-col" style={{ gap: 'var(--space-sm)' }}>
        <p className="font-mono-label">Add an opportunity</p>
        <div className="flex" style={{ gap: 'var(--space-sm)', flexWrap: 'wrap' }}>
          <select className="input-field" style={{ width: 'auto' }} value={surface} onChange={(e) => setSurface(e.target.value as CommunitySurface)} aria-label="Surface">
            {SURFACES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
          <input className="input-field" style={{ flex: 1, minWidth: 200 }} placeholder="Post URL" value={url} onChange={(e) => setUrl(e.target.value)} />
        </div>
        <input className="input-field" placeholder="Post title / question" value={title} onChange={(e) => setTitle(e.target.value)} />
        <button className="btn-ghost" type="button" onClick={addOpportunity} disabled={busy !== null} style={{ width: 'fit-content' }}>Add to feed</button>
      </div>

      {opps.length === 0 ? (
        <div className="card"><p className="font-sans-body">No opportunities yet. Add relevant discussions above, then draft honest replies.</p></div>
      ) : (
        opps.map((o) => (
          <div key={o.id} className="card card--dense flex flex-col" style={{ gap: 'var(--space-sm)' }}>
            <div className="flex items-center" style={{ gap: 'var(--space-md)' }}>
              <span className="font-mono-micro" style={{ color: 'var(--cyan)', width: 110 }}>{SURFACE_LABEL[o.surface] ?? o.surface}</span>
              <a className="font-sans-label" style={{ flex: 1, color: 'var(--paper)', textDecoration: 'none' }} href={o.url} target="_blank" rel="noreferrer">{o.title} ↗</a>
              <span className={o.status === 'responded' ? 'status-live' : o.status === 'ignored' ? 'status-dead' : 'status-pending'}>{o.status}</span>
            </div>
            {drafts[o.id] !== undefined ? (
              <>
                <textarea
                  className="input-field"
                  rows={5}
                  value={drafts[o.id]}
                  onChange={(e) => setDrafts((prev) => ({ ...prev, [o.id]: e.target.value }))}
                  aria-label="Draft response"
                />
                <div className="flex" style={{ gap: 'var(--space-sm)', flexWrap: 'wrap' }}>
                  <button className="btn-ghost" type="button" onClick={() => void navigator.clipboard.writeText(drafts[o.id])}>Copy</button>
                  <a className="btn-ghost" style={{ textDecoration: 'none' }} href={o.url} target="_blank" rel="noreferrer">Open post</a>
                  <button className="btn-primary" type="button" onClick={() => markPosted(o.id)} disabled={busy === o.id}>Mark as responded</button>
                </div>
              </>
            ) : (
              <button className="btn-primary" type="button" onClick={() => draft(o.id)} disabled={busy === o.id} style={{ width: 'fit-content' }}>
                {busy === o.id ? 'Drafting…' : 'Generate response'}
              </button>
            )}
          </div>
        ))
      )}

      {msg && <p className="font-mono-micro">{msg}</p>}
    </div>
  )
}
