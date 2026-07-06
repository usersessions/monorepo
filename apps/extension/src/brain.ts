import type { CopyResponse, SiteData, TelemetryBatch } from '@usersessions/shared'

/**
 * AI copy client. The Gemini key NEVER lives in the extension — generation happens on the
 * dashboard's Bearer-authenticated /api/ai/copy route using the token from ExtensionBridge.
 */

const DASHBOARD_URL = process.env.PLASMO_PUBLIC_DASHBOARD_URL ?? 'https://usersessions.io'

async function getToken(): Promise<string> {
  const { accessToken } = await chrome.storage.local.get('accessToken')
  if (!accessToken) throw new Error('Not connected — sign in on the dashboard first.')
  return accessToken as string
}

export async function generateCopy(site: SiteData): Promise<CopyResponse> {
  const token = await getToken()
  const res = await fetch(`${DASHBOARD_URL}/api/ai/copy`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(site),
  })
  if (!res.ok) {
    let code = ''
    try {
      code = ((await res.json()) as { error?: string }).error ?? ''
    } catch {
      // non-JSON error body — fall through to generic messages
    }
    if (res.status === 401) throw new Error('Session expired — open the dashboard to reconnect.')
    if (code === 'AI_NOT_CONFIGURED')
      throw new Error('AI copy is not configured on the server yet (Gemini key missing) — contact support.')
    throw new Error('Copy generation failed — try again in a moment.')
  }
  return (await res.json()) as CopyResponse
}

/** Fire-and-forget. Telemetry must never block or break the user flow. */
export async function sendTelemetry(batch: TelemetryBatch): Promise<void> {
  try {
    const token = await getToken()
    void fetch(`${DASHBOARD_URL}/api/telemetry/ai-edits`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(batch),
    })
  } catch {
    // swallowed by design
  }
}
