import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

const READY = ['ready', 'completed']
const FAILED = ['failed', 'scrape_failed', 'prompt_failed']

/** Analytics — real per-user video generation stats from the videos table. */
export default async function AnalyticsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  let videos: { id: string; title: string | null; status: string; created_at: string }[] = []
  if (user) {
    const { data } = await supabase
      .from('videos')
      .select('id, title, status, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
    videos = data ?? []
  }

  const total = videos.length
  const ready = videos.filter((v) => READY.includes(v.status)).length
  const failed = videos.filter((v) => FAILED.includes(v.status)).length
  const inProgress = total - ready - failed
  const successRate = total > 0 ? Math.round((ready / total) * 100) : null
  const recent = videos.slice(0, 10)

  const stats = [
    { label: 'Videos generated', value: total.toString() },
    { label: 'Ready', value: ready.toString() },
    { label: 'In progress', value: inProgress.toString() },
    { label: 'Failed', value: failed.toString() },
    { label: 'Success rate', value: successRate === null ? '—' : `${successRate}%` },
  ]

  return (
    <div className="flex flex-col" style={{ gap: 'var(--space-lg)' }}>
      <header>
        <h1>Analytics</h1>
        <p style={{ color: 'var(--muted)' }}>Your video generation performance.</p>
      </header>

      <div className="grid grid-cols-2 md:grid-cols-5" style={{ gap: 'var(--space-md)' }}>
        {stats.map((s) => (
          <div key={s.label} className="card" style={{ padding: 'var(--space-md)' }}>
            <p className="font-mono-label">{s.label}</p>
            <p style={{ fontSize: '1.75rem', fontWeight: 600 }}>{s.value}</p>
          </div>
        ))}
      </div>

      <div className="card" style={{ padding: 'var(--space-lg)' }}>
        <p className="font-mono-label" style={{ marginBottom: 'var(--space-md)' }}>Recent videos</p>
        {recent.length === 0 ? (
          <p style={{ color: 'var(--muted)' }}>No videos yet. Generate a video to start collecting stats.</p>
        ) : (
          recent.map((v) => (
            <div key={v.id} className="flex items-center" style={{ gap: 'var(--space-md)', padding: 'var(--space-sm) 0', borderTop: '1px solid var(--border)' }}>
              <Link href={`/videos/${v.id}`} style={{ flex: 1, textDecoration: 'none', color: 'inherit' }}>
                {v.title || 'Untitled video'}
              </Link>
              <span
                className="font-mono-micro"
                style={{ color: READY.includes(v.status) ? 'var(--green, #15803D)' : FAILED.includes(v.status) ? 'var(--red, #B91C1C)' : 'var(--muted)' }}
              >
                {v.status}
              </span>
              <span className="font-mono-micro" style={{ color: 'var(--muted)' }}>
                {new Date(v.created_at).toISOString().slice(0, 10)}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
