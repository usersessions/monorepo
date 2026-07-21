export const dynamic = 'force-dynamic'

/** Analytics — metrics replaced in the video pivot. TODO(pivot): views, plays, completion rate. */
export default function AnalyticsPage() {
  return (
    <div className="flex flex-col" style={{ gap: 'var(--space-lg)' }}>
      <header>
        <h1>Analytics</h1>
        <p style={{ color: 'var(--muted)' }}>Video performance metrics will appear here.</p>
      </header>
      <div className="card" style={{ padding: 'var(--space-lg)' }}>
        <p style={{ color: 'var(--muted)' }}>No video metrics yet. Generate a video to start collecting stats.</p>
      </div>
    </div>
  )
}
