import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { TrackView } from '@/components/TrackView'
import { CompetitorScanner } from './CompetitorScanner'

export default async function CompetitorsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: scans, error: scansError } = await supabase
    .from('competitor_scans')
    .select('*')
    .order('scanned_at', { ascending: false })
    .limit(50)

  if (scansError) {
    throw new Error(`Failed to load competitor scans (${scansError.message})`)
  }

  // Feature D: latest weekly intelligence briefing (real data only; owner-scoped via RLS).
  const { data: briefing } = await supabase
    .from('intelligence_briefings')
    .select('new_competitor_listings, new_platforms, category_shifts, created_at')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const newCompetitors = (briefing?.new_competitor_listings as string[] | undefined) ?? []
  const newPlatforms = (briefing?.new_platforms as string[] | undefined) ?? []
  const categoryShifts = (briefing?.category_shifts as string[] | undefined) ?? []
  const hasMove = newCompetitors.length > 0 || categoryShifts.length > 0

  return (
    <div className="flex flex-col" style={{ gap: 'var(--space-xl)', maxWidth: 800 }}>
      <TrackView feature="competitor_scan" />
      <header className="flex flex-col" style={{ gap: 'var(--space-xs)' }}>
        <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: '2rem' }}>Competitor Scan</h1>
        <p className="font-sans-body">
          Run an on-demand AI query to see if your competitors are being recommended by AI engines.
        </p>
      </header>

      {/* Weekly Briefing (Feature D) */}
      <section className="card flex flex-col" style={{ gap: 'var(--space-md)', borderColor: hasMove ? 'var(--amber)' : undefined }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
          <h2 className="font-mono-label" style={{ flex: 1 }}>Weekly briefing</h2>
          {hasMove && <span className="status-pending">competitor moved</span>}
        </div>
        {!briefing ? (
          <p className="font-sans-body">
            Your first briefing lands after a full week of tracking. Paying plans get it by email every
            Monday — real signals only, never padded.
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3" style={{ gap: 'var(--space-md)' }}>
            <div>
              <p className="font-mono-label">New competitors</p>
              <p className="font-serif-metric">{newCompetitors.length}</p>
              {newCompetitors[0] && <p className="font-mono-micro">e.g. {newCompetitors[0]}</p>}
            </div>
            <div>
              <p className="font-mono-label">New platforms</p>
              <p className="font-serif-metric">{newPlatforms.length}</p>
              {newPlatforms[0] && <p className="font-mono-micro">e.g. {newPlatforms[0]}</p>}
            </div>
            <div>
              <p className="font-mono-label">Queries to defend</p>
              <p className="font-serif-metric" style={{ color: categoryShifts.length ? 'var(--amber)' : 'var(--paper)' }}>{categoryShifts.length}</p>
              {categoryShifts[0] && <p className="font-mono-micro">e.g. “{categoryShifts[0]}”</p>}
            </div>
          </div>
        )}
      </section>

      <CompetitorScanner initialScans={scans ?? []} />
    </div>
  )
}
