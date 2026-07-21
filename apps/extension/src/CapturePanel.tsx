import { useState } from 'react'

/** Replaces AgentPanel/SurfacesPanel — captures the active tab for product→video generation. */
export function CapturePanel() {
  const [status, setStatus] = useState<'idle' | 'capturing' | 'done' | 'error'>('idle')
  const [shot, setShot] = useState<string | null>(null)

  async function capture() {
    setStatus('capturing')
    try {
      const res = (await chrome.runtime.sendMessage({ type: 'CAPTURE_SCREENSHOT' })) as {
        ok: boolean
        dataUrl?: string
      }
      if (!res?.ok || !res.dataUrl) throw new Error('capture failed')
      setShot(res.dataUrl)
      setStatus('done')
    } catch {
      setStatus('error')
    }
  }

  return (
    <div>
      <button onClick={capture} disabled={status === 'capturing'} style={{ width: '100%', padding: 8 }}>
        {status === 'capturing' ? 'Capturing…' : 'Capture this page'}
      </button>
      {status === 'error' && <p style={{ color: '#c00', fontSize: 12 }}>Could not capture this tab.</p>}
      {shot && <img src={shot} alt="Page capture" style={{ width: '100%', marginTop: 8, borderRadius: 4 }} />}
      {status === 'done' && (
        <p style={{ fontSize: 12, opacity: 0.7 }}>Open the dashboard → Generate to turn this product into a video.</p>
      )}
    </div>
  )
}
