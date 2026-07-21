'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'

const NAV_ITEMS = [
  { label: 'Overview', href: '/', icon: '◉' },
  { label: 'Generate', href: '/generate', icon: '⚡' },
  { label: 'Videos', href: '/videos', icon: '▶' },
  { label: 'Products', href: '/products', icon: '⊞' },
  { label: 'Analytics', href: '/analytics', icon: '↗' },
  { label: 'Settings', href: '/settings', icon: '⚙' },
  { label: 'Billing & plan', href: '/pricing', icon: '$' },
  { label: 'Support', href: '/support', icon: '?' },
]

export function CommandPalette() {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  const filtered = query.trim()
    ? NAV_ITEMS.filter((item) => item.label.toLowerCase().includes(query.toLowerCase()))
    : NAV_ITEMS

  const close = useCallback(() => {
    setOpen(false)
    setQuery('')
    setSelected(0)
  }, [])

  const navigate = useCallback(
    (href: string) => {
      close()
      router.push(href)
    },
    [close, router]
  )

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const isMac = navigator.platform.includes('Mac')
      const modKey = isMac ? e.metaKey : e.ctrlKey
      if (modKey && e.key === 'k') {
        e.preventDefault()
        setOpen((v) => !v)
      }
      if (e.key === 'Escape') close()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [close])

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [open])

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelected((s) => Math.min(s + 1, filtered.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelected((s) => Math.max(s - 1, 0))
    } else if (e.key === 'Enter') {
      const item = filtered[selected]
      if (item) navigate(item.href)
    }
  }

  if (!open) return null

  return (
    <>
      {/* Backdrop */}
      <div
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(9,9,15,0.7)',
          backdropFilter: 'blur(4px)',
          zIndex: 200,
        }}
        onClick={close}
        aria-hidden
      />

      {/* Palette */}
      <div
        role="dialog"
        aria-label="Command palette"
        aria-modal="true"
        style={{
          position: 'fixed',
          top: '20vh',
          left: '50%',
          transform: 'translateX(-50%)',
          width: '100%',
          maxWidth: 560,
          background: 'var(--ink-2)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--rounded-lg)',
          boxShadow: '0 24px 80px rgba(0,0,0,0.6)',
          zIndex: 201,
          overflow: 'hidden',
        }}
        onKeyDown={handleKeyDown}
      >
        {/* Search input */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-sm)',
            padding: 'var(--space-md)',
            borderBottom: '1px solid var(--border)',
          }}
        >
          <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--muted-2)', fontSize: '1rem' }}>⌘</span>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => { setQuery(e.target.value); setSelected(0) }}
            placeholder="Jump to…"
            style={{
              flex: 1,
              background: 'none',
              border: 'none',
              outline: 'none',
              fontFamily: 'var(--font-sans)',
              fontSize: '1rem',
              color: 'var(--paper)',
            }}
          />
          <kbd
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '0.6rem',
              color: 'var(--muted-2)',
              border: '1px solid var(--border)',
              borderRadius: 2,
              padding: '2px 4px',
            }}
          >
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div style={{ maxHeight: 320, overflowY: 'auto' }}>
          {filtered.length === 0 ? (
            <p
              style={{
                padding: 'var(--space-lg)',
                fontFamily: 'var(--font-sans)',
                color: 'var(--muted)',
                textAlign: 'center',
              }}
            >
              No pages found for "{query}"
            </p>
          ) : (
            filtered.map((item, i) => (
              <button
                key={item.href}
                onClick={() => navigate(item.href)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--space-md)',
                  width: '100%',
                  padding: 'var(--space-sm) var(--space-md)',
                  background: i === selected ? 'var(--primary-dim)' : 'none',
                  border: 'none',
                  cursor: 'pointer',
                  textAlign: 'left',
                  borderLeft: i === selected ? '2px solid var(--primary)' : '2px solid transparent',
                  transition: 'background 80ms',
                }}
                onMouseEnter={() => setSelected(i)}
              >
                <span
                  style={{
                    width: 24,
                    fontFamily: 'var(--font-mono)',
                    fontSize: '0.75rem',
                    color: 'var(--muted-2)',
                    textAlign: 'center',
                    flexShrink: 0,
                  }}
                >
                  {item.icon}
                </span>
                <span
                  style={{
                    fontFamily: 'var(--font-sans)',
                    fontSize: '0.9375rem',
                    fontWeight: 600,
                    color: 'var(--paper)',
                  }}
                >
                  {item.label}
                </span>
              </button>
            ))
          )}
        </div>

        {/* Footer hint */}
        <div
          style={{
            borderTop: '1px solid var(--border)',
            padding: 'var(--space-sm) var(--space-md)',
            display: 'flex',
            gap: 'var(--space-md)',
          }}
        >
          {[['↑↓', 'navigate'], ['↵', 'open'], ['esc', 'close']].map(([key, action]) => (
            <span key={key} className="font-mono-micro">
              <kbd style={{ border: '1px solid var(--border)', borderRadius: 2, padding: '1px 4px', marginRight: 4 }}>
                {key}
              </kbd>
              {action}
            </span>
          ))}
        </div>
      </div>
    </>
  )
}
