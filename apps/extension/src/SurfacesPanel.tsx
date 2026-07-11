import { useEffect, useState } from 'react'
import type { Surface } from '@usersessions/shared'

interface SurfaceEntry {
  surface: Surface
  unlocked: boolean
}

const CATEGORY_LABEL: Record<string, string> = {
  github: 'GitHub',
  blog: 'Blog',
  twitter: 'X / Twitter',
  podcast: 'Podcast',
  youtube: 'YouTube',
  stackoverflow: 'Stack Overflow',
  community: 'Community',
}

/**
 * Distribute to Surfaces (Feature C popup UI). Assisted distribution: picking a surface
 * opens it in a tab with an editable AI-drafted post; the human posts it themselves.
 * tracked_only surfaces (e.g. X) open with a “verify my profile” flow instead of a draft.
 */
export function SurfacesPanel({ connected, ready }: { connected: boolean; ready: boolean }) {
  const [entries, setEntries] = useState<SurfaceEntry[] | null>(null)
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)

  useEffect(() => {
    if (!open || entries) return
    chrome.runtime.sendMessage({ type: 'GET_SURFACES' }, (res) => setEntries(res?.surfaces ?? []))
  }, [open, entries])

  const distribute = (e: SurfaceEntry) => {
    setBusy(e.surface.id)
    setMsg(null)
    const type = e.surface.submissionType === 'tracked_only' ? 'VERIFY_SURFACE' : 'DISTRIBUTE_SURFACE'
    chrome.runtime.sendMessage(
      { type, surfaceId: e.surface.id, surfaceName: e.surface.name, url: e.surface.urlPattern },
      (res) => {
        setBusy(null)
        setMsg(
          res?.ok
            ? e.surface.submissionType === 'tracked_only'
              ? `Opened ${e.surface.name} — use the panel to verify your profile.`
              : `Opened ${e.surface.name} — edit the draft in the sidebar, then post it yourself.`
            : res?.error ?? 'Could not open that surface. Analyze your product first.'
        )
      }
    )
  }

  return (
    <div className="site-card" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
      <button className="btn-ghost" onClick={() => setOpen((v) => !v)} disabled={!connected}>
        {open ? 'Hide surfaces' : 'Distribute to Surfaces'}
      </button>

      {open && !connected && (
        <p className="font-mono-micro" style={{ color: 'var(--amber)' }}>Connect first to load surfaces.</p>
      )}

      {open && connected && (
        <>
          {!ready && (
            <p className="font-mono-micro">Analyze your product page above so we can draft surface copy.</p>
          )}
          {entries === null ? (
            <p className="font-mono-micro">Loading surfaces…</p>
          ) : entries.length === 0 ? (
            <p className="font-mono-micro">No surfaces available yet.</p>
          ) : (
            entries.map((e) => (
              <div key={e.surface.id} className="card card--dense site-card" style={{ opacity: e.unlocked ? 1 : 0.5 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span className="font-mono-data" style={{ flex: 1 }}>{e.surface.name}</span>
                  <span className="font-mono-micro" style={{ color: 'var(--cyan)' }}>
                    {CATEGORY_LABEL[e.surface.category] ?? e.surface.category}
                  </span>
                </div>
                {e.unlocked ? (
                  <button
                    className="btn-ghost"
                    onClick={() => distribute(e)}
                    disabled={busy !== null || !ready}
                  >
                    {busy === e.surface.id
                      ? 'Opening…'
                      : e.surface.submissionType === 'tracked_only'
                        ? 'Open & verify'
                        : 'Draft & open'}
                  </button>
                ) : (
                  <span className="font-mono-micro" style={{ color: 'var(--amber)' }}>
                    Unlocks on {['Free', 'Founder', 'Pro', 'Agency'][e.surface.tierUnlock]}
                  </span>
                )}
              </div>
            ))
          )}
          {msg && <p className="font-mono-micro">{msg}</p>}
        </>
      )}
    </div>
  )
}
