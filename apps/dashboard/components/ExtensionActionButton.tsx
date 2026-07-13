'use client'

import { useEffect, useState } from 'react'
import { CHROME_STORE_URL, extensionSupported, pingExtension, triggerLaunch, triggerSurface, triggerCapture } from '@/lib/extension-bridge'
import { trackFeature } from '@/lib/tracking'
import type { FeatureName } from '@usersessions/shared'

type Action = 'launch' | 'surface' | 'capture'

const FEATURE_BY_ACTION: Record<Action, FeatureName> = {
  launch: 'campaign_launch',
  surface: 'surface_distribution',
  capture: 'aio_audit',
}

/**
 * A dashboard button that triggers an extension action, with full graceful degradation:
 * if the extension can't be reached it shows an install/guidance CTA instead of promising an
 * action it can't deliver.
 */
export function ExtensionActionButton({
  action,
  surfaceId,
  label,
  className = 'btn-ghost',
}: {
  action: Action
  surfaceId?: string
  label: string
  className?: string
}) {
  const [installed, setInstalled] = useState<boolean | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!extensionSupported()) {
      setInstalled(false)
      return
    }
    void pingExtension().then(setInstalled)
  }, [])

  if (installed === false) {
    return (
      <a className="font-mono-micro" href={CHROME_STORE_URL} target="_blank" rel="noreferrer" style={{ color: 'var(--primary)', textDecoration: 'none' }}>
        Install the extension →
      </a>
    )
  }

  async function run() {
    trackFeature(FEATURE_BY_ACTION[action], 'click', { metadata: surfaceId ? { surfaceId } : undefined })
    setBusy(true)
    setMsg(null)
    const res =
      action === 'launch'
        ? await triggerLaunch()
        : action === 'surface'
          ? await triggerSurface(surfaceId ?? '')
          : await triggerCapture()
    setBusy(false)
    if (res === null) {
      setMsg(
        action === 'capture'
          ? 'Click the extension icon on your product’s page to capture.'
          : 'Open the extension manually, or make sure you are signed in.'
      )
    } else if ((res as { ok?: boolean }).ok) {
      setMsg(
        action === 'launch'
          ? 'Launch started — check the extension.'
          : action === 'surface'
            ? 'Opened in a new tab — edit the draft and post it.'
            : 'Captured the active tab.'
      )
    } else {
      const err = (res as { error?: string }).error
      setMsg(
        err === 'NOT_CONNECTED'
          ? 'Sign in on the dashboard so the extension can connect.'
          : action === 'capture'
            ? 'Couldn’t capture — click the extension icon on the target page.'
            : err === 'TIER_LOCKED'
              ? 'That surface is locked on your plan.'
              : 'Analyze your product page in the extension first.'
      )
    }
  }

  return (
    <div className="flex flex-col" style={{ gap: 4 }}>
      <button
        className={className}
        type="button"
        onClick={run}
        disabled={busy || installed === null}
        title={action === 'capture' ? 'Best-effort; open the extension on the target page for reliable capture.' : undefined}
      >
        {busy ? 'Working…' : label}
      </button>
      {msg && <span className="font-mono-micro" style={{ color: 'var(--muted-2)' }}>{msg}</span>}
    </div>
  )
}
