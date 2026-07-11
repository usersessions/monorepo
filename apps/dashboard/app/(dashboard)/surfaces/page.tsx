import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { planRank } from '@/lib/tiers'

const CATEGORY_LABEL: Record<string, string> = {
  github: 'GitHub',
  blog: 'Blogs',
  twitter: 'X / Twitter',
  podcast: 'Podcasts',
  youtube: 'YouTube',
  stackoverflow: 'Stack Overflow',
  community: 'Communities',
}

const TYPE_LABEL: Record<string, string> = {
  assisted_manual: 'assisted',
  tracked_only: 'tracked',
  automated: 'automated',
}

/**
 * Surfaces (Feature C): AI-training surfaces beyond directories. Assisted distribution +
 * tracking, tier-gated. Locked surfaces are shown at reduced opacity (aspirational, honest).
 */
export default async function SurfacesPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: profile }, { data: surfaces, error }] = await Promise.all([
    supabase.from('profiles').select('plan').eq('id', user.id).maybeSingle(),
    supabase.from('surfaces').select('*').eq('active', true).order('quality_score', { ascending: false }),
  ])
  if (error) throw new Error(`Failed to load surfaces (${error.message})`)

  const rank = planRank(profile?.plan)
  const byCategory = new Map<string, typeof surfaces>()
  for (const s of surfaces ?? []) {
    const list = byCategory.get(s.category) ?? []
    list.push(s)
    byCategory.set(s.category, list)
  }

  return (
    <div className="flex flex-col" style={{ gap: 'var(--space-xl)', maxWidth: 900 }}>
      <header className="flex flex-col" style={{ gap: 'var(--space-xs)' }}>
        <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: '2rem' }}>Surfaces</h1>
        <p className="font-sans-body" style={{ maxWidth: 640 }}>
          Where AI assistants learn about products beyond directories. Assisted distribution — the
          extension pre-fills honest, editable copy and you post it in your own account. Nothing is
          submitted automatically, and every word is yours to change.
        </p>
      </header>

      {[...byCategory.entries()].map(([cat, list]) => (
        <section key={cat} className="flex flex-col" style={{ gap: 'var(--space-md)' }}>
          <h2 className="font-mono-label">{CATEGORY_LABEL[cat] ?? cat}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3" style={{ gap: 'var(--space-md)' }}>
            {(list ?? []).map((s) => {
              const locked = rank < s.tier_unlock
              return (
                <div
                  key={s.id}
                  className="card card--dense flex flex-col"
                  style={{ gap: 'var(--space-sm)', opacity: locked ? 0.5 : 1 }}
                >
                  <div className="flex items-center" style={{ gap: 'var(--space-sm)' }}>
                    <span className="font-sans-label" style={{ flex: 1, color: 'var(--paper)' }}>{s.name}</span>
                    <span className="font-mono-micro" style={{ color: 'var(--cyan)' }}>{TYPE_LABEL[s.submission_type]}</span>
                  </div>
                  <p className="font-mono-micro">Quality {s.quality_score}</p>
                  {locked ? (
                    <span className="font-mono-micro" style={{ color: 'var(--amber)' }}>
                      Unlocks on {['Free', 'Founder', 'Pro', 'Agency'][s.tier_unlock]}
                    </span>
                  ) : (
                    <span className="status-pending">Not started</span>
                  )}
                </div>
              )
            })}
          </div>
        </section>
      ))}

      <p className="font-mono-micro">
        Open the extension and choose “Distribute to Surfaces” to get pre-filled copy for each
        unlocked surface.
      </p>
    </div>
  )
}
