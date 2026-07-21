import { VideoGenerator } from '@/components/VideoGenerator'
import { CreditCounter } from '@/components/CreditCounter'

export const dynamic = 'force-dynamic'

export default function GeneratePage() {
  return (
    <div className="flex flex-col" style={{ gap: 'var(--space-lg)' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <div>
          <h1>Generate</h1>
          <p style={{ color: 'var(--muted)' }}>Paste a product URL, approve the prompt, get a video.</p>
        </div>
        <CreditCounter />
      </header>
      <VideoGenerator />
    </div>
  )
}
