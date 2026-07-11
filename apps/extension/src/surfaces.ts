import type { Surface, SurfaceCopyResponse } from '@usersessions/shared'

/**
 * Surfaces client (Feature C extension flow). Reads the Bearer token from storage,
 * fetches the tier-annotated catalog, and requests surface-specific assisted copy.
 * Copy is ALWAYS a draft the user edits before posting — nothing is auto-submitted.
 */

const DASHBOARD_URL = process.env.PLASMO_PUBLIC_DASHBOARD_URL ?? 'https://usersessions.io'

export interface SurfaceEntry {
  surface: Surface
  unlocked: boolean
}

export async function fetchSurfaces(): Promise<SurfaceEntry[] | null> {
  const { accessToken } = await chrome.storage.local.get('accessToken')
  if (!accessToken) return null
  try {
    const res = await fetch(`${DASHBOARD_URL}/api/surfaces`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    if (!res.ok) return null
    const body = (await res.json()) as { ok?: boolean; surfaces?: SurfaceEntry[] }
    return body.ok ? (body.surfaces ?? []) : null
  } catch {
    return null
  }
}

export async function fetchSurfaceCopy(input: {
  surfaceId: string
  title: string
  url: string
  description: string
}): Promise<{ ok: true; copy: string } | { ok: false; error: string }> {
  const { accessToken } = await chrome.storage.local.get('accessToken')
  if (!accessToken) return { ok: false, error: 'NOT_CONNECTED' }
  try {
    const res = await fetch(`${DASHBOARD_URL}/api/surfaces/copy`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    })
    const body = (await res.json()) as SurfaceCopyResponse
    if (body.ok && body.copy) return { ok: true, copy: body.copy }
    return { ok: false, error: body.error ?? 'FAILED' }
  } catch {
    return { ok: false, error: 'FAILED' }
  }
}
