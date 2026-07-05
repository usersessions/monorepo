import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { CompetitorScanner } from './CompetitorScanner'

export default async function CompetitorsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: scans } = await supabase
    .from('competitor_scans')
    .select('*')
    .order('scanned_at', { ascending: false })
    .limit(50)

  return (
    <div className="flex flex-col" style={{ gap: 'var(--space-xl)', maxWidth: 800 }}>
      <header className="flex flex-col" style={{ gap: 'var(--space-xs)' }}>
        <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: '2rem' }}>Competitor Scan</h1>
        <p className="font-sans-body">
          Run an on-demand AI query to see if your competitors are being recommended by AI engines.
        </p>
      </header>

      <CompetitorScanner initialScans={scans ?? []} />
    </div>
  )
}
