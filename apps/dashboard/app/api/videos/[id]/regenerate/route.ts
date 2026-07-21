import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateMiniMaxVideo } from '@/services/minimax'

type Ctx = { params: Promise<{ id: string }> }

export async function POST(_req: Request, context: Ctx) {
  const { id } = await Promise.resolve(context.params)
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const { data: video } = await supabase.from('videos').select('*').eq('id', id).eq('user_id', user.id).single()
  if (!video) return NextResponse.json({ error: 'not found' }, { status: 404 })
  try {
    const { task_id } = await generateMiniMaxVideo({ prompt: video.prompt })
    await supabase.from('videos').update({ fal_request_id: task_id, status: 'generating', video_url: null }).eq('id', id)
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'resubmission failed' }, { status: 502 })
  }
}
