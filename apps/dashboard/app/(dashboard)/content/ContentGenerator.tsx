'use client'

import { useState } from 'react'
import { trackFeature } from '@/lib/tracking'
import type { ContentGenerateResponse, ContentType } from '@usersessions/shared'

const TYPES: { value: ContentType; label: string }[] = [
  { value: 'vs_page', label: 'Vs page' },
  { value: 'best_tools_roundup', label: 'Best-tools roundup' },
  { value: 'alternative_post', label: 'Alternative post' },
  { value: 'faq_page', label: 'FAQ page' },
]

export function ContentGenerator({
  products,
  competitors,
}: {
  products: { id: string; name: string }[]
  competitors: string[]
}) {
  const [productId, setProductId] = useState(products[0]?.id ?? '')
  const [contentType, setContentType] = useState<ContentType>('vs_page')
  const [picked, setPicked] = useState<string[]>([])
  const [markdown, setMarkdown] = useState('')
  const [schema, setSchema] = useState('')
  const [publishedUrl, setPublishedUrl] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  function toggle(c: string) {
    setPicked((prev) => (prev.includes(c) ? prev.filter((x) => x !== c) : prev.length < 3 ? [...prev, c] : prev))
  }

  async function generate() {
    trackFeature('comparison_content_generate', 'click', { productId })
    setBusy(true)
    setMsg(null)
    try {
      const res = await fetch('/api/ai/content', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId, contentType, competitors: picked }),
      })
      const data = (await res.json()) as ContentGenerateResponse
      if (!data.ok || !data.markdown) {
        setMsg(data.error === 'PLAN_LIMIT_EXCEEDED' ? 'You have hit your content limit this month.' : 'Generation failed. Try again.')
      } else {
        setMarkdown(data.markdown)
        setSchema(data.schemaSuggestion ?? '')
      }
    } catch {
      setMsg('Generation failed. Try again.')
    } finally {
      setBusy(false)
    }
  }

  async function save() {
    setBusy(true)
    setMsg(null)
    try {
      const res = await fetch('/api/content', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId, contentType, draftMarkdown: markdown, publishedUrl: publishedUrl || undefined }),
      })
      const data = await res.json()
      setMsg(data.ok ? 'Saved.' : 'Save failed.')
    } catch {
      setMsg('Save failed.')
    } finally {
      setBusy(false)
    }
  }

  function copyMd() {
    void navigator.clipboard.writeText(markdown).then(() => setMsg('Markdown copied.'))
  }

  function downloadHtml() {
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8">${schema ? `<script type="application/ld+json">${schema.replace(/</g, '\\u003c')}</script>` : ''}</head><body><pre>${markdown.replace(/</g, '&lt;')}</pre></body></html>`
    const blob = new Blob([html], { type: 'text/html' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `${contentType}.html`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  const needsCompetitors = contentType === 'vs_page' || contentType === 'alternative_post' || contentType === 'best_tools_roundup'

  return (
    <div className="card flex flex-col" style={{ gap: 'var(--space-md)' }}>
      <div className="flex" style={{ gap: 'var(--space-sm)', flexWrap: 'wrap' }}>
        <select className="input-field" style={{ width: 'auto' }} value={productId} onChange={(e) => setProductId(e.target.value)} aria-label="Product">
          {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <select className="input-field" style={{ width: 'auto' }} value={contentType} onChange={(e) => setContentType(e.target.value as ContentType)} aria-label="Content type">
          {TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
      </div>

      {needsCompetitors && (
        <div>
          <p className="font-mono-micro" style={{ marginBottom: 'var(--space-xs)' }}>
            Pick up to 3 competitors (from your competitor scans){competitors.length === 0 ? ' — none yet; run a competitor scan first' : ''}
          </p>
          <div className="flex" style={{ gap: 'var(--space-xs)', flexWrap: 'wrap' }}>
            {competitors.map((c) => (
              <button
                key={c}
                type="button"
                className={picked.includes(c) ? 'btn-primary' : 'btn-ghost'}
                onClick={() => toggle(c)}
                style={{ fontSize: '0.7rem', padding: '2px 8px' }}
              >
                {c}
              </button>
            ))}
          </div>
        </div>
      )}

      <button className="btn-primary" type="button" onClick={generate} disabled={busy} style={{ width: 'fit-content' }}>
        {busy ? 'Generating…' : 'Generate content'}
      </button>

      {markdown && (
        <>
          <textarea className="input-field" rows={16} value={markdown} onChange={(e) => setMarkdown(e.target.value)} aria-label="Draft markdown" style={{ fontFamily: 'var(--font-mono)', fontSize: '12px' }} />
          {schema && (
            <div>
              <p className="font-mono-micro">Suggested schema.org JSON-LD:</p>
              <pre className="font-mono-micro" style={{ whiteSpace: 'pre-wrap', color: 'var(--muted-2)' }}>{schema}</pre>
            </div>
          )}
          <div className="flex" style={{ gap: 'var(--space-sm)', flexWrap: 'wrap', alignItems: 'center' }}>
            <button className="btn-ghost" type="button" onClick={copyMd}>Copy markdown</button>
            <button className="btn-ghost" type="button" onClick={downloadHtml}>Download HTML</button>
            <input className="input-field" style={{ flex: 1, minWidth: 200 }} placeholder="Published URL (optional)" value={publishedUrl} onChange={(e) => setPublishedUrl(e.target.value)} />
            <button className="btn-primary" type="button" onClick={save} disabled={busy}>Save draft</button>
          </div>
        </>
      )}

      {msg && <p className="font-mono-micro">{msg}</p>}
    </div>
  )
}
