'use client'

export function VideoPlayer({ src, poster }: { src: string; poster?: string | null }) {
  return (
    <video
      controls
      playsInline
      src={src}
      poster={poster ?? undefined}
      style={{ width: '100%', borderRadius: 8, background: '#000' }}
    />
  )
}
