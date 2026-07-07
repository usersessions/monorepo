'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

/**
 * Per-adapter live-mode toggle (migration 0020). The user runs a simulation, reviews
 * the filled form in their own browser, and only then marks the adapter verified —
 * from that moment the extension runs THIS platform live for THIS user.
 */
export function PlatformVerifyButton({
  platformId,
  verified,
}: {
  platformId: string
  verified: boolean
}) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)

  const toggle = async () => {
    setBusy(true)
    try {
      await fetch('/api/platforms/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ platformId, verified: !verified }),
      })
      router.refresh()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex items-center" style={{ gap: 'var(--space-sm)' }}>
      {verified ? (
        <span className="font-mono-micro" style={{ color: 'var(--green)' }}>
          ✓ verified — runs live
        </span>
      ) : (
        <span className="font-mono-micro" style={{ color: 'var(--muted-2)' }}>
          simulate first, then verify
        </span>
      )}
      <button
        type="button"
        onClick={toggle}
        disabled={busy}
        className="font-mono-micro"
        style={{
          marginLeft: 'auto',
          background: 'transparent',
          border: '1px solid var(--border)',
          borderRadius: 4,
          padding: '2px 8px',
          color: verified ? 'var(--amber)' : 'var(--green)',
          cursor: busy ? 'wait' : 'pointer',
        }}
      >
        {busy ? '…' : verified ? 'Revoke' : 'Mark as verified'}
      </button>
    </div>
  )
}
