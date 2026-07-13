'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { trackFeature } from '@/lib/tracking'
import type {
  CreatePlatformRequestInput,
  PlatformRequest,
  PlatformRequestCategory,
  PlatformRequestListResponse,
  PlatformRequestResponse,
  PlatformVoteResponse,
} from '@usersessions/shared'

const CATEGORY_OPTIONS: { value: PlatformRequestCategory; label: string }[] = [
  { value: 'ai', label: 'AI' },
  { value: 'startup', label: 'Startup' },
  { value: 'saas', label: 'SaaS' },
  { value: 'dev', label: 'Dev' },
  { value: 'marketplace', label: 'Marketplace' },
  { value: 'other', label: 'Other' },
]

function RequestModal({
  onClose,
  onCreated,
}: {
  onClose: () => void
  onCreated: (r: PlatformRequest) => void
}) {
  const [name, setName] = useState('')
  const [url, setUrl] = useState('')
  const [category, setCategory] = useState<PlatformRequestCategory>('ai')
  const [description, setDescription] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit() {
    if (!name.trim()) {
      setError('Platform name is required.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      const payload: CreatePlatformRequestInput = {
        name: name.trim(),
        url: url.trim() || undefined,
        category,
        description: description.trim() || undefined,
      }
      const res = await fetch('/api/platform-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = (await res.json()) as PlatformRequestResponse
      if (!data.ok || !data.request) {
        setError(
          data.error === 'DUPLICATE_NAME'
            ? 'That platform has already been requested — find it below and upvote it instead.'
            : 'Could not submit the request. Please try again.'
        )
        return
      }
      onCreated(data.request)
      onClose()
    } catch {
      setError('Could not submit the request. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 'var(--space-md)' }}
      onClick={onClose}
    >
      <div className="card flex flex-col" style={{ gap: 'var(--space-md)', maxWidth: 480, width: '100%' }} onClick={(e) => e.stopPropagation()}>
        <p className="font-mono-label">Request a platform</p>
        <input className="input-field" placeholder="Platform name" value={name} onChange={(e) => setName(e.target.value)} maxLength={120} />
        <input className="input-field" placeholder="URL (optional)" value={url} onChange={(e) => setUrl(e.target.value)} maxLength={500} />
        <select className="input-field" value={category} onChange={(e) => setCategory(e.target.value as PlatformRequestCategory)} aria-label="Category">
          {CATEGORY_OPTIONS.map((c) => (
            <option key={c.value} value={c.value}>{c.label}</option>
          ))}
        </select>
        <textarea
          className="input-field"
          rows={3}
          placeholder="Why this matters (optional)"
          value={description}
          onChange={(e) => setDescription(e.target.value.slice(0, 500))}
          maxLength={500}
        />
        <p className="font-mono-micro" style={{ textAlign: 'right' }}>{description.length}/500</p>
        {error && <p className="font-mono-micro" style={{ color: 'var(--red)' }}>{error}</p>}
        <div className="flex" style={{ gap: 'var(--space-sm)' }}>
          <button className="btn-primary" type="button" onClick={submit} disabled={busy}>
            {busy ? 'Submitting…' : 'Submit request'}
          </button>
          <button className="btn-ghost" type="button" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  )
}

/**
 * "Can't find your platform?" section: top-5 requested list with live vote counts
 * (Supabase realtime on platform_requests, migration 0036) + a request modal.
 * One vote per user per request, toggle to remove.
 */
export function PlatformRequestBoard() {
  const router = useRouter()
  const [requests, setRequests] = useState<PlatformRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [votingId, setVotingId] = useState<string | null>(null)

  async function load() {
    try {
      const res = await fetch('/api/platform-requests')
      const data = (await res.json()) as PlatformRequestListResponse
      if (data.ok) setRequests(data.requests)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
    const supabase = createClient()
    const channel = supabase
      .channel('platform-requests-board')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'platform_requests' }, () => void load())
      .subscribe()
    return () => void supabase.removeChannel(channel)
  }, [])

  const top5 = useMemo(() => [...requests].sort((a, b) => b.voteCount - a.voteCount).slice(0, 5), [requests])

  async function vote(r: PlatformRequest) {
    setVotingId(r.id)
    trackFeature('platform_browse', 'click', { metadata: { requestId: r.id, action: r.hasVoted ? 'unvote' : 'vote' } })
    try {
      const res = await fetch(`/api/platform-requests/${r.id}/vote`, { method: r.hasVoted ? 'DELETE' : 'POST' })
      const data = (await res.json()) as PlatformVoteResponse
      if (data.ok) {
        setRequests((prev) =>
          prev.map((x) => (x.id === r.id ? { ...x, voteCount: data.voteCount ?? x.voteCount, hasVoted: data.hasVoted ?? x.hasVoted } : x))
        )
      }
    } finally {
      setVotingId(null)
    }
  }

  return (
    <section className="flex flex-col" style={{ gap: 'var(--space-md)' }}>
      <div className="flex items-center" style={{ gap: 'var(--space-md)', flexWrap: 'wrap', justifyContent: 'space-between' }}>
        <div>
          <h2 className="font-mono-label">Can't find your platform?</h2>
          <p className="font-sans-body">Request it. We build adapters for the most wanted platforms first.</p>
        </div>
        <button className="btn-primary" type="button" onClick={() => setModalOpen(true)}>
          Request a platform
        </button>
      </div>

      <div className="card card--dense flex flex-col" style={{ gap: 'var(--space-xs)' }}>
        <p className="font-mono-label" style={{ marginBottom: 'var(--space-xs)' }}>Top requested</p>
        {loading ? (
          <p className="font-sans-body">Loading…</p>
        ) : top5.length === 0 ? (
          <p className="font-sans-body">No requests yet. Be the first to suggest a platform.</p>
        ) : (
          top5.map((r) => (
            <div key={r.id} className="flex items-center" style={{ gap: 'var(--space-md)', borderTop: '1px solid var(--border)', paddingTop: 'var(--space-xs)' }}>
              <button
                type="button"
                onClick={() => vote(r)}
                disabled={votingId === r.id}
                aria-label={r.hasVoted ? 'Remove vote' : 'Upvote'}
                title={r.hasVoted ? 'Remove your vote' : 'Upvote'}
                style={{
                  background: 'transparent',
                  border: '1px solid var(--border)',
                  borderRadius: 4,
                  padding: '2px 8px',
                  color: r.hasVoted ? 'var(--primary)' : 'var(--muted-2)',
                  cursor: votingId === r.id ? 'wait' : 'pointer',
                }}
              >
                ▲ {r.voteCount}
              </button>
              <span className="font-sans-label" style={{ flex: 1, color: 'var(--paper)' }}>{r.name}</span>
              <span className="font-mono-micro">{CATEGORY_OPTIONS.find((c) => c.value === r.category)?.label ?? r.category}</span>
            </div>
          ))
        )}
      </div>

      {modalOpen && (
        <RequestModal
          onClose={() => setModalOpen(false)}
          onCreated={(r) => {
            setRequests((prev) => [r, ...prev])
            router.refresh()
          }}
        />
      )}
    </section>
  )
}
