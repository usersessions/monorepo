import type { CampaignPayload, CampaignResponse } from '@usersessions/shared'

/**
 * Campaign ingestion client — called by the M6 campaign loop after adapters finish
 * (and after each simulated run). Distinguishes PLAN_LIMIT_EXCEEDED so the popup can
 * show its specific upgrade state (BUILD_SPEC §11) instead of a generic error.
 */

const DASHBOARD_URL = process.env.PLASMO_PUBLIC_DASHBOARD_URL ?? 'https://usersessions.io'

export type PostCampaignResult =
  | { ok: true; campaignId: string }
  | { ok: false; error: 'PLAN_LIMIT_EXCEEDED' | 'NOT_CONNECTED' | 'FAILED' }

export async function postCampaign(payload: CampaignPayload): Promise<PostCampaignResult> {
  const { accessToken } = await chrome.storage.local.get('accessToken')
  if (!accessToken) return { ok: false, error: 'NOT_CONNECTED' }

  try {
    const res = await fetch(`${DASHBOARD_URL}/api/campaigns`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    })

    if (res.status === 401) {
      void chrome.storage.local.remove('accessToken')
      return { ok: false, error: 'NOT_CONNECTED' }
    }

    const body = (await res.json()) as CampaignResponse
    if (body.ok && body.campaignId) return { ok: true, campaignId: body.campaignId }
    if (body.error === 'PLAN_LIMIT_EXCEEDED') return { ok: false, error: 'PLAN_LIMIT_EXCEEDED' }
    return { ok: false, error: 'FAILED' }
  } catch {
    return { ok: false, error: 'FAILED' }
  }
}

export interface RemoteFounderProfile {
  founderName?: string
  contactEmail?: string
}

/**
 * Signup data reused: name/email come from the dashboard profile so users never
 * re-type them. Best-effort — any failure returns null and the local profile
 * (or empty fields) is used instead.
 */
export async function fetchFounderProfile(): Promise<RemoteFounderProfile | null> {
  const { accessToken } = await chrome.storage.local.get('accessToken')
  if (!accessToken) return null

  try {
    const res = await fetch(`${DASHBOARD_URL}/api/profile`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    if (!res.ok) return null
    const body = (await res.json()) as RemoteFounderProfile
    return { founderName: body.founderName, contactEmail: body.contactEmail }
  } catch {
    return null
  }
}

/**
 * Per-platform live verification map (adapter_verifications, migration 0020) — set by
 * the user in the dashboard after reviewing a simulated run. FAIL-CLOSED: a missing
 * token or any error returns {} so every platform stays in simulation.
 */
export async function fetchVerifications(): Promise<Record<string, boolean>> {
  const { accessToken } = await chrome.storage.local.get('accessToken')
  if (!accessToken) return {}

  try {
    const res = await fetch(`${DASHBOARD_URL}/api/platforms/verify`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    if (!res.ok) return {}
    const body = (await res.json()) as { verifications?: Record<string, boolean> }
    return body.verifications ?? {}
  } catch {
    return {}
  }
}
