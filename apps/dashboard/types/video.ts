export type VideoStatus = 'queued' | 'generating' | 'ready' | 'failed'

export interface Video {
  id: string
  product_url: string | null
  title: string
  prompt: string
  status: VideoStatus
  video_url: string | null
  thumbnail_url: string | null
  duration_seconds: number | null
  fal_request_id: string | null
  created_at: string
}
