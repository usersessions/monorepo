import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { submitVideo } from '@/services/minimax-client'

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
    const baseUrl = process.env.PUBLIC_BASE_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");
    const webhookUrl = `${baseUrl}/api/webhooks/minimax/${video.id}`;
    const result = await submitVideo(body.prompt, 6, true, webhookUrl);
    await supabase.from('videos').update({ fal_request_id: result.task_id, status: 'generating' }).eq('id', video.id)
  } catch (err: any) {
    await supabase.from('videos').update({ status: 'failed', error: err.message || 'Submission failed' }).eq('id', video.id)
  }
  return NextResponse.json({ video }, { status: 201 })
}
