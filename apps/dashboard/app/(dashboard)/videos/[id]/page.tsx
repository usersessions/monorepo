'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { VideoPlayer } from '@/components/VideoPlayer'
import { GenerationProgress } from '@/components/GenerationProgress'
import type { Video } from '@/types/video'

export default function VideoDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const [id, setId] = useState<string | null>(null)
  const [video, setVideo] = useState<Video | null>(null)
  const [missing, setMissing] = useState(false)
  const [caption, setCaption] = useState<string | null>(null)
  const [generatingCaption, setGeneratingCaption] = useState(false)

  const handleGenerateCaption = async () => {
    if (!id) return
    setGeneratingCaption(true)
    try {
      const res = await fetch(`/api/videos/${id}/caption`, { method: 'POST' })
      const data = await res.json()
      if (data.caption) {
        setCaption(data.caption)
      }
    } finally {
      setGeneratingCaption(false)
    }
  }

  useEffect(() => {
    Promise.resolve(params).then((p) => setId(p.id))
  }, [params])

  // Initial fetch
  useEffect(() => {
    if (!id) return
    let active = true
    fetch(`/api/videos/${id}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => {
        if (active) setVideo(d.video)
      })
      .catch(() => {
        if (active) setMissing(true)
      })
    return () => {
      active = false
    }
  }, [id])

  // Polling loop when generating
  useEffect(() => {
    if (!id || !video) return
    if (video.status !== 'queued' && video.status !== 'generating') return

    let active = true
    const poll = async () => {
      try {
        const res = await fetch(`/api/videos/${id}/poll`, { method: 'POST' })
        if (!res.ok) return
        const data = await res.json()
        if (!active) return

        if (data.status === 'ready') {
          setVideo((v) => (v ? { ...v, status: 'ready', video_url: data.video_url } : null))
        } else if (data.status === 'failed') {
          setVideo((v) => (v ? { ...v, status: 'failed' } : null))
        }
      } catch (err) {
        console.error('Polling failed:', err)
      }
    }

    // Poll every 5 seconds
    const interval = setInterval(poll, 5000)
    return () => {
      active = false
      clearInterval(interval)
    }
  }, [id, video?.status])

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

      {video.status === 'ready' && (
        <div className="card flex flex-col" style={{ gap: 'var(--space-md)' }}>
          <h2 className="font-mono-label">Social Media Caption</h2>
          {caption ? (
            <div className="p-4 bg-muted rounded-md border">
              <p className="font-sans-body whitespace-pre-wrap">{caption}</p>
            </div>
          ) : (
            <div>
              <button
                className="btn-primary"
                onClick={handleGenerateCaption}
                disabled={generatingCaption}
              >
                {generatingCaption ? 'Writing caption...' : 'Auto-Generate Caption'}
              </button>
              <p className="font-mono-micro mt-2 text-muted-foreground">
                Uses our Anti-AI copy guardrails to write a natural, high-converting caption for TikTok/Reels.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
