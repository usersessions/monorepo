'use client'

import { useState } from 'react'
import { trackFeature } from '@/lib/tracking'
import type { SuggestedQuery, SuggestQueriesResponse, VisibilityQueryType } from '@usersessions/shared'
import { approveSuggestedQuery } from './actions'

const TYPE_LABEL: Record<VisibilityQueryType, string> = {
  category_direct: 'Category',
  use_case: 'Use case',
  comparison: 'Comparison',
  alternative: 'Alternative',
}

/**
 * AI-assisted query suggestions. Gemini proposes; the user edits and explicitly
 * approves each one before it is saved (nothing is auto-tracked).
 */
export function SuggestQueries({ productId }: { productId: string }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [suggestions, setSuggestions] = useState<SuggestedQuery[]>([])

  async function suggest() {
    trackFeature('ai_visibility_suggest', 'click', { productId })
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/visibility/suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId }),
      })
      const data = (await res.json()) as SuggestQueriesResponse
      if (!data.ok || !data.suggestions) {
        setError(
          data.error === 'AI_NOT_CONFIGURED'
            ? 'AI suggestions are not configured yet.'
            : 'Could not generate suggestions. Try again in a minute.'
        )
      } else {
        setSuggestions(data.suggestions)
      }
    } catch {
      setError('Could not generate suggestions. Try again in a minute.')
    } finally {
      setLoading(false)
    }
  }

  function edit(i: number, value: string) {
    setSuggestions((prev) => prev.map((s, idx) => (idx === i ? { ...s, query: value } : s)))
  }

  function dismiss(i: number) {
    setSuggestions((prev) => prev.filter((_, idx) => idx !== i))
  }

  return (
    <div style={{ marginTop: 'var(--space-md)' }}>
      <button className="btn-ghost" type="button" onClick={suggest} disabled={loading}>
        {loading ? 'Thinking…' : 'Suggest queries with AI'}
      </button>
      {error && <p className="font-mono-micro" style={{ color: 'var(--amber)', marginTop: 'var(--space-xs)' }}>{error}</p>}

      {suggestions.length > 0 && (
        <div className="flex flex-col" style={{ gap: 'var(--space-sm)', marginTop: 'var(--space-md)' }}>
          <p className="font-mono-micro">Review and edit each one — nothing is tracked until you approve it.</p>
          {suggestions.map((s, i) => (
            <form
              key={i}
              action={approveSuggestedQuery}
              className="flex items-center"
              style={{ gap: 'var(--space-sm)', flexWrap: 'wrap' }}
            >
              <input type="hidden" name="productId" value={productId} />
              <input type="hidden" name="queryType" value={s.queryType} />
              <input type="hidden" name="categoryTag" value={s.categoryTag ?? ''} />
              <span className="font-mono-micro" style={{ color: 'var(--cyan)', width: 84 }}>{TYPE_LABEL[s.queryType]}</span>
              <input
                className="input-field"
                style={{ flex: 1, minWidth: 220 }}
                value={s.query}
                onChange={(e) => edit(i, e.target.value)}
                aria-label="Suggested query"
              />
              <button className="btn-ghost" type="submit">Approve</button>
              <button className="btn-ghost" type="button" onClick={() => dismiss(i)} aria-label="Dismiss">×</button>
            </form>
          ))}
        </div>
      )}
    </div>
  )
}
