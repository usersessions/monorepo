'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { VideoPlayer } from '@/components/VideoPlayer'
import { GenerationProgress } from '@/components/GenerationProgress'
import type { Video } from '@/types/video'

export default function VideoDetailPage({ params }: { params: { id: string } | Promise<{ id: string }> }) {
  const [id, setId] = useState<string | null>(null)
  const [video, setVideo] = useState<Video | null>(null)
  const [missing, setMissing] = useState(false)

  useEffect(() => {
    Promise.resolve(params).then((p) => setId(p.id))
  }, [params])

  useEffect(() => {
    if (!id) return
    fetch(`/api/videos/${id}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => setVideo(d.video))
      .catch(() => setMissing(true))
  }, [id])

  if (missing)
    return (
      <p>
        Video not found. <Link href="/videos">Back to library</Link>
      </p>
    )
  if (!video) return <p style={{ color: 'var(--muted)' }}>Loading…</p>

  return (
    <div className="flex flex-col" style={{ gap: 'var(--space-lg)', maxWidth: 800 }}>
      <header>
        <h1>{video.title}</h1>
        <GenerationProgress status={video.status} />
      </header>
      {video.video_url ? (
        <VideoPlayer src={video.video_url} poster={video.thumbnail_url} />
      ) : (
        <p style={{ color: 'var(--muted)' }}>Still generating — check back shortly.</p>
      )}
      <details>
        <summary className="font-mono-micro">Prompt</summary>
        <p style={{ color: 'var(--muted)' }}>{video.prompt}</p>
      </details>
    </div>
  )
}
