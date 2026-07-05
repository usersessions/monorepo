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

    const body = (await res.json()) as CampaignResponse
    if (body.ok && body.campaignId) return { ok: true, campaignId: body.campaignId }
    if (body.error === 'PLAN_LIMIT_EXCEEDED') return { ok: false, error: 'PLAN_LIMIT_EXCEEDED' }
    return { ok: false, error: 'FAILED' }
  } catch {
    return { ok: false, error: 'FAILED' }
  }
}
