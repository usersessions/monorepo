import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { queryVideoTask, getVideoFileUrl } from '@/services/minimax'

type Ctx = { params: Promise<{ id: string }> }

/**
 * POST /api/videos/[id]/poll
 *
 * Checks MiniMax task status for a single video and updates the DB row.
 * Called client-side while the video page is open and status === 'generating'.
 * Returns the updated video row so the UI can re-render without a full refetch.
 */
export async function POST(_req: Request, context: Ctx) {
  const { id } = await context.params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  // Fetch the video — must belong to this user
  const { data: video } = await supabase
    .from('videos')
    .select('id, status, fal_request_id, user_id')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (!video) return NextResponse.json({ error: 'not found' }, { status: 404 })

  // Nothing to do if already terminal
  if (video.status === 'ready' || video.status === 'failed') {
    return NextResponse.json({ status: video.status })
  }

  const taskId = video.fal_request_id
  if (!taskId) {
    return NextResponse.json({ status: 'generating', message: 'No task_id yet' })
  }

  try {
    const task = await queryVideoTask(taskId)

    if (task.status === 'Success' && task.file_id) {
      const videoUrl = await getVideoFileUrl(task.file_id)
      await supabase
        .from('videos')
        .update({ status: 'ready', video_url: videoUrl })
        .eq('id', id)
      return NextResponse.json({ status: 'ready', video_url: videoUrl })
    }

    if (task.status === 'Fail') {
      await supabase
        .from('videos')
        .update({ status: 'failed' })
        .eq('id', id)
      return NextResponse.json({ status: 'failed', reason: task.err_msg ?? 'MiniMax generation failed' })
    }

    // Still Queueing or Processing
    return NextResponse.json({ status: 'generating', minimax_status: task.status })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Poll error'
    return NextResponse.json({ status: 'error', message: msg }, { status: 502 })
  }
}
