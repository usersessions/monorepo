import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { submitVideoGeneration } from '@/services/fal'

// TODO(pivot): requires `videos` table migration (0037_videos) before this returns data.
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const { data, error } = await supabase
    .from('videos')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
  if (error) return NextResponse.json({ videos: [] })
  return NextResponse.json({ videos: data })
}

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const body = (await req.json().catch(() => null)) as { title?: string; prompt?: string; productUrl?: string } | null
  if (!body?.prompt || !body.title) return NextResponse.json({ error: 'title and prompt required' }, { status: 400 })
  const { data: video, error } = await supabase
    .from('videos')
    .insert({ user_id: user.id, title: body.title, prompt: body.prompt, product_url: body.productUrl ?? null, status: 'queued' })
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  try {
    const webhook = process.env.NEXT_PUBLIC_APP_URL ? `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/fal` : undefined
    const { requestId } = await submitVideoGeneration(body.prompt, webhook)
    await supabase.from('videos').update({ fal_request_id: requestId, status: 'generating' }).eq('id', video.id)
  } catch {
    // fail-soft: video stays queued; the regenerate endpoint can retry
  }
  return NextResponse.json({ video }, { status: 201 })
}
