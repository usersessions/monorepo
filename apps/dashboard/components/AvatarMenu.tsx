'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'

interface AvatarMenuProps {
  displayName: string
  email: string
  plan: string
  initial: string
}

export function AvatarMenu({ displayName, email, plan, initial }: AvatarMenuProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [])

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="avatar-trigger"
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label="Account menu"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-sm)',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          borderRadius: 'var(--rounded-sm)',
          padding: 'var(--space-xs)',
          width: '100%',
          textAlign: 'left',
        }}
      >
        <span
          style={{
            width: 32,
            height: 32,
            borderRadius: '50%',
            background: 'var(--primary-dim)',
            border: '1px solid var(--border)',
            fontFamily: 'var(--font-serif)',
            fontSize: '1rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            color: 'var(--paper)',
          }}
        >
          {initial}
        </span>
        <div style={{ minWidth: 0, flex: 1 }}>
          <p className="font-mono-micro truncate" style={{ color: 'var(--paper)' }}>
            {displayName}
          </p>
          <p className="font-mono-micro" style={{ color: 'var(--muted-2)' }}>
            plan: {plan}
          </p>
        </div>
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '0.5rem',
            color: 'var(--muted-2)',
            transform: open ? 'rotate(180deg)' : 'none',
            transition: 'transform 150ms',
          }}
        >
          ▼
        </span>
      </button>

      {open && (
        <div
          role="menu"
          style={{
            position: 'absolute',
            bottom: 'calc(100% + 4px)',
            left: 0,
            right: 0,
            background: 'var(--ink-2)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--rounded-md)',
            overflow: 'hidden',
            zIndex: 50,
            boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
          }}
        >
          {/* Identity header */}
          <div
            style={{
              padding: 'var(--space-md)',
              borderBottom: '1px solid var(--border)',
            }}
          >
            <p className="font-sans-body" style={{ color: 'var(--paper)', fontWeight: 600, margin: 0 }}>
              {displayName !== email ? displayName : ''}
            </p>
            <p className="font-mono-micro" style={{ marginTop: 2 }}>
              {email}
            </p>
          </div>

          {/* Menu items */}
          {[
            { label: 'Settings', href: '/settings' },
            { label: 'Billing & plan', href: '/pricing' },
            { label: 'Support', href: '/support' },
          ].map((item) => (
            <Link
              key={item.href}
              href={item.href}
              role="menuitem"
              onClick={() => setOpen(false)}
              style={{
                display: 'block',
                padding: 'var(--space-sm) var(--space-md)',
                fontFamily: 'var(--font-sans)',
                fontSize: '0.8125rem',
                fontWeight: 600,
                color: 'var(--muted)',
                textDecoration: 'none',
                transition: 'color 100ms, background 100ms',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = 'var(--paper)'
                e.currentTarget.style.background = 'var(--primary-dim)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = 'var(--muted)'
                e.currentTarget.style.background = ''
              }}
            >
              {item.label}
            </Link>
          ))}

          {/* Sign out */}
          <div style={{ borderTop: '1px solid var(--border)' }}>
            <form action="/auth/signout" method="post">
              <button
                type="submit"
                role="menuitem"
                style={{
                  display: 'block',
                  width: '100%',
                  textAlign: 'left',
                  padding: 'var(--space-sm) var(--space-md)',
                  fontFamily: 'var(--font-sans)',
                  fontSize: '0.8125rem',
                  fontWeight: 600,
                  color: 'var(--red)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                Sign out
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
