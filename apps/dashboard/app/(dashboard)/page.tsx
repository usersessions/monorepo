import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export default async function OverviewPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  let generatedCount = 0
  let readyCount = 0
  let creditsLeft = 0

  if (user) {
    const { count: totalCount } = await supabase
      .from('videos')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      
    const { count: completedCount } = await supabase
      .from('videos')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .in('status', ['ready', 'completed'])

    const { data: profile } = await supabase
      .from('profiles')
      .select('videos_limit_this_month, videos_used_this_month')
      .eq('id', user.id)
      .single()

    generatedCount = totalCount || 0
    readyCount = completedCount || 0
    
    if (profile) {
      creditsLeft = (profile.videos_limit_this_month || 0) - (profile.videos_used_this_month || 0)
    }
  }

  const stats = [
    { label: 'Videos generated', value: generatedCount.toString() },
    { label: 'Videos ready', value: readyCount.toString() },
    { label: 'Credits left', value: creditsLeft.toString() },
  ]
  return (
    <div className="flex flex-col" style={{ gap: 'var(--space-lg)' }}>
      <header>
        <h1>Overview</h1>
        <p style={{ color: 'var(--muted)' }}>Turn any product page into a marketing video.</p>
      </header>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 'var(--space-md)' }}>
        {stats.map((s) => (
          <div key={s.label} className="card" style={{ padding: 'var(--space-md)' }}>
            <p className="font-mono-micro" style={{ color: 'var(--muted)' }}>{s.label}</p>
            <p style={{ fontSize: '2rem' }}>{s.value}</p>
          </div>
        ))}
      </div>
      <div>
        <Link href="/generate" className="nav-link">Generate your first video →</Link>
      </div>
    </div>
  )
}
