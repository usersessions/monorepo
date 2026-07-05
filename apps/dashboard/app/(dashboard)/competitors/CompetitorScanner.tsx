'use client'

import { useState } from 'react'

type Scan = {
  id: string
  query: string
  competitor_name: string
  competitor_url: string
  mentioned: boolean
  rank: number | null
  snippet: string | null
  scanned_at: string
}

export function CompetitorScanner({ initialScans }: { initialScans: Scan[] }) {
  const [scans, setScans] = useState<Scan[]>(initialScans)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [query, setQuery] = useState('')
  const [name, setName] = useState('')
  const [url, setUrl] = useState('')

  const handleScan = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!query || !name || !url) return
    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/competitors/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, competitorName: name, competitorUrl: url }),
      })

      if (!res.ok) {
        throw new Error('Failed to run AI scan. Please try again.')
      }

      const result = await res.json()
      setScans([result, ...scans])
      setQuery('')
      setName('')
      setUrl('')
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col" style={{ gap: 'var(--space-lg)' }}>
      <div className="card flex flex-col" style={{ gap: 'var(--space-md)' }}>
        <h2 className="font-mono-label">Run a new scan</h2>
        <form onSubmit={handleScan} className="flex flex-col" style={{ gap: 'var(--space-md)' }}>
          <div className="grid grid-cols-1 md:grid-cols-2" style={{ gap: 'var(--space-md)' }}>
            <div className="flex flex-col" style={{ gap: 'var(--space-xs)' }}>
              <label className="font-mono-label" htmlFor="competitorName">Competitor Name</label>
              <input
                id="competitorName"
                className="input-field"
                type="text"
                placeholder="Acme Corp"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            <div className="flex flex-col" style={{ gap: 'var(--space-xs)' }}>
              <label className="font-mono-label" htmlFor="competitorUrl">Competitor URL</label>
              <input
                id="competitorUrl"
                className="input-field"
                type="url"
                placeholder="https://acme.corp"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                required
              />
            </div>
          </div>
          <div className="flex flex-col" style={{ gap: 'var(--space-xs)' }}>
            <label className="font-mono-label" htmlFor="query">AI Prompt / Query</label>
            <input
              id="query"
              className="input-field"
              type="text"
              placeholder="What is the best enterprise widget builder?"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              required
            />
          </div>

          {error && <p className="font-mono-micro" style={{ color: 'var(--red)' }}>{error}</p>}

          <div>
            <button className="btn-primary" type="submit" disabled={loading}>
              {loading ? 'Scanning AI models...' : 'Run competitor scan'}
            </button>
          </div>
        </form>
      </div>

      <div className="flex flex-col" style={{ gap: 'var(--space-md)' }}>
        <h2 className="font-mono-label">Past Scans</h2>
        {scans.length === 0 ? (
          <p className="font-sans-body" style={{ color: 'var(--muted-2)' }}>No competitor scans run yet.</p>
        ) : (
          <div className="flex flex-col" style={{ gap: 'var(--space-sm)' }}>
            {scans.map((s) => (
              <div key={s.id} className="card card--dense flex flex-col" style={{ gap: 'var(--space-xs)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 'var(--space-sm)', flexWrap: 'wrap' }}>
                  <p className="font-mono-data">{s.competitor_name} <span style={{ opacity: 0.5 }}>for</span> "{s.query}"</p>
                  <p className="font-mono-micro">{new Date(s.scanned_at).toLocaleString()}</p>
                </div>
                <div style={{ display: 'flex', gap: 'var(--space-sm)', alignItems: 'center' }}>
                  <span className={s.mentioned ? 'status-live' : 'status-dead'}>
                    {s.mentioned ? 'Mentioned' : 'Not mentioned'}
                  </span>
                  {s.rank && <span className="font-mono-micro">Rank: {s.rank}</span>}
                </div>
                {s.snippet && (
                  <p className="font-sans-body" style={{ fontStyle: 'italic', color: 'var(--muted-2)', marginTop: 'var(--space-xs)' }}>
                    "{s.snippet}"
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
