import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

/** fal.ai completion webhook. TODO(pivot): replace shared-secret check with fal's official signature scheme. */
export async function POST(req: Request) {
  const secret = process.env.FAL_WEBHOOK_SECRET
  if (secret && req.headers.get('x-webhook-secret') !== secret) {
    return NextResponse.json({ error: 'invalid signature' }, { status: 401 })
  }
  const body = (await req.json().catch(() => null)) as
    | { request_id?: string; status?: string; payload?: { video?: { url?: string } } }
    | null
  if (!body?.request_id) return NextResponse.json({ error: 'request_id required' }, { status: 400 })
  const supabase = createServiceClient()
  const ok = body.status === 'OK' || body.status === 'COMPLETED'
  const videoUrl = body.payload?.video?.url ?? null
  await supabase
    .from('videos')
    .update(ok && videoUrl ? { status: 'ready', video_url: videoUrl } : { status: 'failed' })
    .eq('fal_request_id', body.request_id)
  return NextResponse.json({ received: true })
}
