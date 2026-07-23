import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { submitVideo } from '@/services/minimax-client'

// Force dynamic: Supabase URL is a runtime env var on Cloudflare, not a build var.
export const dynamic = 'force-dynamic'


type Ctx = { params: Promise<{ id: string }> }

export async function POST(_req: Request, context: Ctx) {
  const { id } = await Promise.resolve(context.params)
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const { data: video } = await supabase.from('videos').select('*').eq('id', id).eq('user_id', user.id).single()
  if (!video) return NextResponse.json({ error: 'not found' }, { status: 404 })
  if (!video.prompt) return NextResponse.json({ error: 'This video has no prompt to regenerate from.' }, { status: 400 })
  try {
    // Only send a callback URL when it is publicly reachable — MiniMax
    // challenge-validates callback_url at submit time and rejects the whole
    // submission if it cannot reach it. Without a callback the poll route
    // recovers the result.
    const baseUrl = process.env.PUBLIC_BASE_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null)
    const webhookUrl = baseUrl ? `${baseUrl}/api/webhooks/minimax/${id}` : undefined
    const result = await submitVideo(video.prompt, 6, true, webhookUrl)
    await supabase.from('videos').update({ fal_request_id: result.task_id, status: 'generating', video_url: null, error: null }).eq('id', id)
    return NextResponse.json({ ok: true })
  } catch (err: any) {
    const message = err?.message || 'Regeneration failed'
    // Persist the upstream MiniMax error so the UI and admin can see why it failed.
    await supabase.from('videos').update({ status: 'failed', error: message }).eq('id', id)
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
