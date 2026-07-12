'use client'

import { useEffect, useState } from 'react'
import { CHROME_STORE_URL, extensionSupported, pingExtension } from '@/lib/extension-bridge'

/** Settings → extension connection status. Ping on load only; no polling, no trigger. */
export function ExtensionStatus() {
  const [state, setState] = useState<'checking' | 'connected' | 'missing'>('checking')

  useEffect(() => {
    if (!extensionSupported()) {
      setState('missing')
      return
    }
    void pingExtension().then((ok) => setState(ok ? 'connected' : 'missing'))
  }, [])

  return (
    <section className="card flex flex-col" style={{ gap: 'var(--space-sm)' }}>
      <h2 className="font-mono-label">Browser extension</h2>
      {state === 'checking' ? (
        <p className="font-mono-micro">Checking…</p>
      ) : state === 'connected' ? (
        <p className="font-mono-label" style={{ color: 'var(--green)' }}>✓ Extension connected</p>
      ) : (
        <>
          <p className="font-mono-label" style={{ color: 'var(--amber)' }}>Extension not detected</p>
          <a className="font-mono-micro" href={CHROME_STORE_URL} target="_blank" rel="noreferrer" style={{ color: 'var(--primary)', textDecoration: 'none' }}>
            Install the extension →
          </a>
        </>
      )}
    </section>
  )
}
