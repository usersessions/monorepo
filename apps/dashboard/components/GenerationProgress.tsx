'use client'

import type { VideoStatus } from '@/types/video'

const STEPS: { key: VideoStatus; label: string }[] = [
  { key: 'queued', label: 'Queued' },
  { key: 'generating', label: 'Generating' },
  { key: 'ready', label: 'Ready' },
]

export function GenerationProgress({ status }: { status: VideoStatus }) {
  if (status === 'failed') return <p style={{ color: 'var(--red)' }}>Generation failed. Try regenerating.</p>
  const activeIndex = STEPS.findIndex((s) => s.key === status)
  return (
    <ol style={{ display: 'flex', gap: 'var(--space-md)', listStyle: 'none', padding: 0 }}>
      {STEPS.map((s, i) => (
        <li key={s.key} className="font-mono-micro" style={{ color: i <= activeIndex ? 'var(--cyan)' : 'var(--muted-2)' }}>
          {i <= activeIndex ? '●' : '○'} {s.label}
        </li>
      ))}
    </ol>
  )
}
