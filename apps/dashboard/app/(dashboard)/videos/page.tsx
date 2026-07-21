import { VideoGrid } from '@/components/VideoGrid'

export const dynamic = 'force-dynamic'

export default function VideosPage() {
  return (
    <div className="flex flex-col" style={{ gap: 'var(--space-lg)' }}>
      <header>
        <h1>Videos</h1>
        <p style={{ color: 'var(--muted)' }}>Your generated marketing videos.</p>
      </header>
      <VideoGrid />
    </div>
  )
}
