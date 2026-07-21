/** fal.ai queue client for video generation. TODO(pivot): confirm final model id + payload shape. */
const FAL_MODEL = process.env.FAL_VIDEO_MODEL ?? 'fal-ai/veo3'

export async function submitVideoGeneration(prompt: string, webhookUrl?: string): Promise<{ requestId: string }> {
  const key = process.env.FAL_KEY
  if (!key) throw new Error('FAL_KEY not set')
  const qs = webhookUrl ? `?fal_webhook=${encodeURIComponent(webhookUrl)}` : ''
  const res = await fetch(`https://queue.fal.run/${FAL_MODEL}${qs}`, {
    method: 'POST',
    headers: { authorization: `Key ${key}`, 'content-type': 'application/json' },
    body: JSON.stringify({ prompt }),
  })
  if (!res.ok) throw new Error(`fal.ai error: ${res.status}`)
  const data = (await res.json()) as { request_id?: string }
  if (!data.request_id) throw new Error('fal.ai returned no request_id')
  return { requestId: data.request_id }
}

export async function getGenerationStatus(requestId: string): Promise<{ status: string; videoUrl: string | null }> {
  const key = process.env.FAL_KEY
  if (!key) throw new Error('FAL_KEY not set')
  const res = await fetch(`https://queue.fal.run/${FAL_MODEL}/requests/${requestId}`, {
    headers: { authorization: `Key ${key}` },
  })
  if (!res.ok) return { status: 'IN_PROGRESS', videoUrl: null }
  const data = (await res.json()) as { status?: string; video?: { url?: string } }
  return { status: data.status ?? 'UNKNOWN', videoUrl: data.video?.url ?? null }
}
