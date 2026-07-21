'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import type { Video } from '@/types/video'

export function VideoGrid() {
  const [videos, setVideos] = useState<Video[] | null>(null)
  useEffect(() => {
    fetch('/api/videos')
      .then((r) => r.json())
      .then((d) => setVideos(d.videos ?? []))
      .catch(() => setVideos([]))
  }, [])
  if (videos === null) return <p style={{ color: 'var(--muted)' }}>Loading…</p>
  if (videos.length === 0)
    return (
      <p style={{ color: 'var(--muted)' }}>
        No videos yet. <Link href="/generate">Generate your first video →</Link>
      </p>
    )
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 'var(--space-md)' }}>
      {videos.map((v) => (
        <Link key={v.id} href={`/videos/${v.id}`} className="card" style={{ padding: 'var(--space-md)', display: 'block' }}>
          {v.thumbnail_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={v.thumbnail_url} alt="" style={{ width: '100%', aspectRatio: '16/9', objectFit: 'cover', borderRadius: 4 }} />
          ) : (
            <div style={{ width: '100%', aspectRatio: '16/9', background: 'var(--ink-2)', borderRadius: 4 }} />
          )}
          <p style={{ marginTop: 8 }}>{v.title}</p>
          <p className="font-mono-micro" style={{ color: 'var(--muted)' }}>{v.status}</p>
        </Link>
      ))}
    </div>
  )
}
