/**
 * Community client (Feature 5 in-tab flow). Marks a community opportunity as responded via the
 * dashboard API (Bearer). The founder still posts the reply themselves in the thread.
 */
const DASHBOARD_URL = process.env.PLASMO_PUBLIC_DASHBOARD_URL ?? 'https://usersessions.io'

export async function markCommunityResponded(
  opportunityId: string,
  finalResponse: string
): Promise<{ ok: boolean }> {
  const { accessToken } = await chrome.storage.local.get('accessToken')
  if (!accessToken || !opportunityId) return { ok: false }
  try {
    const res = await fetch(`${DASHBOARD_URL}/api/communities/respond`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ opportunityId, finalResponse, posted: true }),
    })
    return { ok: res.ok }
  } catch {
    return { ok: false }
  }
}
