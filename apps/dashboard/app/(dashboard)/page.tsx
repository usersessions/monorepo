import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { TrendChart } from '@/components/TrendChart'
import { UpgradePrompt, UsageMeter } from '@/components/UpgradePrompt'
import { limitsFor, monthStartIso } from '@/lib/tiers'
import { computeUserInsights } from '@/lib/user-insights'
import InsightsPanel from '@/components/InsightsPanel'
import DeltaBadge from '@/components/admin/DeltaBadge'
import Sparkline from '@/components/admin/Sparkline'
import TimeRangeToggle from '@/components/admin/TimeRangeToggle'
import FreshnessTimestamp from '@/components/admin/FreshnessTimestamp'
import RealtimeIndicator from '@/components/admin/RealtimeIndicator'

const DAY_MS = 24 * 60 * 60 * 1000

const RANGES = ['24h', '7d', '30d', '90d'] as const
type Range = (typeof RANGES)[number]
const RANGE_DAYS: Record<Range, number> = { '24h': 1, '7d': 7, '30d': 30, '90d': 90 }

function pctChange(current: number, previous: number): number | null {
  if (previous === 0) return null
  return ((current - previous) / Math.abs(previous)) * 100
}

export default async function OverviewPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>
}) {
  const { range: rangeParam } = await searchParams
  const range: Range = RANGES.includes(rangeParam as Range) ? (rangeParam as Range) : '30d'
  const days = RANGE_DAYS[range]
  const rangeStart = new Date(Date.now() - days * DAY_MS).toISOString()
  const prevStart = new Date(Date.now() - 2 * days * DAY_MS).toISOString()
  const generatedAt = new Date().toISOString()

  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, email, plan')
    .eq('id', user.id)
    .single()

  const plan = profile?.plan ?? 'free'
  const limits = limitsFor(plan)
  const greeting = profile?.full_name
    ? `Welcome back, ${profile.full_name.split(' ')[0]}.`
    : 'Welcome back.'

  const [
    { count: campaignCount },
    { count: submissionCount },
    { count: liveCount },
    { data: latestScore },
    { data: trend },
    { data: visibilityChecks },
    { data: recent },
    { data: notifications },
    { count: productCount },
    { count: launchesThisMonth },
    { count: visibilityQueryCount },
    { count: newSubmissions },
    { count: prevSubmissions },
    { count: deadCount },
    { data: lastCampaign },
  ] = await Promise.all([
    supabase.from('campaigns').select('*', { count: 'exact', head: true }),
    supabase.from('submissions').select('*', { count: 'exact', head: true }),
    supabase
      .from('submissions')
      .select('*', { count: 'exact', head: true })
      .in('status', ['live', 'indexed']),
    supabase
      .from('distribution_scores')
      .select('score, computed_at')
      .order('computed_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('distribution_scores')
      .select('score, computed_at')
      .gte('computed_at', prevStart)
      .order('computed_at', { ascending: true })
      .limit(360),
    supabase
      .from('visibility_checks')
      .select('mentioned, checked_at')
      .gte('checked_at', prevStart),
    supabase
      .from('submissions')
      .select('platform_id, status, created_at')
      .order('created_at', { ascending: false })
      .limit(10),
    supabase
      .from('notifications')
      .select('id, kind, title, body, read, created_at')
      .order('created_at', { ascending: false })
      .limit(8),
    supabase.from('products').select('*', { count: 'exact', head: true }),
    supabase
      .from('campaigns')
      .select('*', { count: 'exact', head: true })
      .gte('started_at', monthStartIso()),
    supabase.from('visibility_queries').select('*', { count: 'exact', head: true }),
    supabase
      .from('submissions')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', rangeStart),
    supabase
      .from('submissions')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', prevStart)
      .lt('created_at', rangeStart),
    supabase
      .from('submissions')
      .select('*', { count: 'exact', head: true })
      .in('status', ['failed', 'removed']),
    supabase
      .from('campaigns')
      .select('started_at')
      .order('started_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ])

  // AI visibility: mention rate inside the selected range vs the window before it.
  const allChecks = visibilityChecks ?? []
  const curChecks = allChecks.filter((c) => (c.checked_at as string) >= rangeStart)
  const prevChecks = allChecks.filter((c) => (c.checked_at as string) < rangeStart)
  const rateOf = (list: typeof allChecks) =>
    list.length > 0 ? Math.round((list.filter((c) => c.mentioned).length / list.length) * 100) : null
  const mentionRate = rateOf(curChecks)
  const prevMentionRate = rateOf(prevChecks)
  const mentionDelta =
    mentionRate != null && prevMentionRate != null ? pctChange(mentionRate, prevMentionRate) : null

  // Distribution score: trend within the selected range, delta = first vs latest point.
  const trendPoints = (trend ?? []).map((p) => ({
    score: Number(p.score),
    computed_at: p.computed_at as string,
  }))
  const rangedTrend = trendPoints.filter((p) => p.computed_at >= rangeStart)
  const scoreDelta =
    rangedTrend.length >= 2
      ? pctChange(rangedTrend[rangedTrend.length - 1].score, rangedTrend[0].score)
      : null
  const sparkPoints = rangedTrend.map((p) => p.score)
  const chartPoints = rangedTrend.length >= 2 ? rangedTrend : trendPoints

  // Listings momentum: submissions created this window vs the previous window.
  const listingsDelta = pctChange(newSubmissions ?? 0, prevSubmissions ?? 0)

  // Onboarding checklist — mirrors /onboarding, derived from real data only.
  const onboardingSteps = [
    { label: 'Install', done: Boolean(campaignCount) },
    { label: 'Product', done: Boolean(productCount) },
    { label: 'Launch', done: Boolean(campaignCount) },
    { label: 'Live', done: Boolean(liveCount) },
  ]
  const onboardingDone = onboardingSteps.filter((s) => s.done).length

  const atProductLimit = limits.productSlots !== null && (productCount ?? 0) >= limits.productSlots
  const atLaunchLimit =
    limits.launchesPerProductPerMonth !== null &&
    (launchesThisMonth ?? 0) >= limits.launchesPerProductPerMonth * (productCount ?? 1)

  // Insights (GAP 17) — computed from data already on this page.
  const daysSinceLastLaunch = lastCampaign?.started_at
    ? Math.floor((Date.now() - new Date(lastCampaign.started_at).getTime()) / DAY_MS)
    : null
  const launchesTotal = limits.launchesPerProductPerMonth * Math.max(productCount ?? 1, 1)
  const queriesTotal = limits.visibilityQueriesPerProduct * Math.max(productCount ?? 1, 1)
  const insights = computeUserInsights({
    deadCount: deadCount ?? 0,
    daysSinceLastLaunch,
    mentionRate,
    prevMentionRate,
    usagePct: [
      { label: 'Products', pct: limits.productSlots > 0 ? ((productCount ?? 0) / limits.productSlots) * 100 : 0 },
      { label: 'Launches', pct: launchesTotal > 0 ? ((launchesThisMonth ?? 0) / launchesTotal) * 100 : 0 },
      { label: 'Visibility queries', pct: queriesTotal > 0 ? ((visibilityQueryCount ?? 0) / queriesTotal) * 100 : 0 },
    ],
  })

  return (
    <div className="flex flex-col" style={{ gap: 'var(--space-lg)' }}>
      {/* Greeting + range controls */}
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 'var(--space-md)', flexWrap: 'wrap' }}>
        <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.75rem' }}>{greeting}</h1>
        <div className="flex items-center" style={{ gap: 'var(--space-md)', flexWrap: 'wrap' }}>
          <RealtimeIndicator />
          <TimeRangeToggle defaultRange="30d" />
          {!campaignCount && (
            <a
              href="https://usersessions.io#install"
              className="btn-primary"
              style={{ textDecoration: 'none', fontSize: '0.875rem' }}
              target="_blank"
              rel="noreferrer"
            >
              Install the extension →
            </a>
          )}
        </div>
      </div>

      <FreshnessTimestamp generatedAt={generatedAt} />

      {insights.length > 0 && <InsightsPanel insights={insights} />}

      {/* Onboarding checklist — visible until every step is done */}
      {onboardingDone < onboardingSteps.length && (
        <div className="card--dense card flex items-center" style={{ gap: 'var(--space-lg)', flexWrap: 'wrap' }}>
          <span className="font-mono-label">Get started · {onboardingDone}/{onboardingSteps.length}</span>
          {onboardingSteps.map((step, i) => (
            <div key={step.label} className="flex items-center" style={{ gap: 'var(--space-sm)' }}>
              <span
                className="font-mono-label"
                style={{ color: step.done ? 'var(--green)' : 'var(--muted-2)' }}
              >
                {step.done ? '✓' : i + 1 + '.'} {step.label}
              </span>
              {i < onboardingSteps.length - 1 && <span style={{ color: 'var(--muted-2)' }}>→</span>}
            </div>
          ))}
          <Link
            href="/onboarding"
            className="font-mono-micro"
            style={{ color: 'var(--primary)', textDecoration: 'none', marginLeft: 'auto' }}
          >
            Continue →
          </Link>
        </div>
      )}

      {/* Plan usage — only shown when on a capped plan or near a limit */}
      {(atProductLimit || atLaunchLimit || plan === 'free') && (
        <div className="card card--dense" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
          <p className="font-mono-label">Your usage this month</p>
          <UsageMeter
            label="Products"
            used={productCount ?? 0}
            total={limits.productSlots}
          />
          <UsageMeter
            label="Launches"
            used={launchesThisMonth ?? 0}
            total={limits.launchesPerProductPerMonth * Math.max(productCount ?? 1, 1)}
          />
          <UsageMeter
            label="Visibility queries"
            used={visibilityQueryCount ?? 0}
            total={limits.visibilityQueriesPerProduct * Math.max(productCount ?? 1, 1)}
          />
          {(atProductLimit || atLaunchLimit) && plan === 'free' && (
            <UpgradePrompt feature="More products and launches" requiredPlan="founder" />
          )}
        </div>
      )}

      {/* Metric cards */}
      <div className="grid grid-cols-1 md:grid-cols-3" style={{ gap: 'var(--space-lg)' }}>
        <div className="card">
          <p className="font-mono-label">Distribution Score</p>
          {latestScore ? (
            <>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-sm)' }}>
                <p className="font-serif-metric">{latestScore.score}</p>
                {sparkPoints.length >= 2 && <Sparkline points={sparkPoints} width={60} height={24} />}
              </div>
              <DeltaBadge value={scoreDelta} period={range} />
              <p className="font-mono-micro">
                computed {new Date(latestScore.computed_at).toISOString().slice(0, 10)}
              </p>
            </>
          ) : (
            <>
              <p className="font-serif-metric" style={{ color: 'var(--muted-2)' }}>—</p>
              <p className="font-sans-body">Appears after your first launch.</p>
            </>
          )}
        </div>

        <div className="card">
          <p className="font-mono-label">AI Visibility</p>
          {mentionRate != null ? (
            <>
              <p className="font-serif-metric">{mentionRate}%</p>
              <DeltaBadge value={mentionDelta} period={range} />
              <p className="font-mono-micro">of AI answers mention you · last {range} · {curChecks.length} checks</p>
            </>
          ) : (
            <>
              <p className="font-serif-metric" style={{ color: 'var(--muted-2)' }}>—</p>
              <p className="font-sans-body">Tracking begins after your first launch.</p>
            </>
          )}
        </div>

        <div className="card">
          <p className="font-mono-label">Live listings</p>
          {submissionCount ? (
            <>
              <p className="font-serif-metric">{liveCount ?? 0}</p>
              <DeltaBadge value={listingsDelta} period={range} />
              <p className="font-mono-micro">
                live or indexed · of {submissionCount} submissions · {newSubmissions ?? 0} new in last {range}
              </p>
            </>
          ) : (
            <>
              <p className="font-serif-metric" style={{ color: 'var(--muted-2)' }}>—</p>
              <p className="font-sans-body">Your listings appear here after your first launch.</p>
            </>
          )}
        </div>
      </div>

      {/* Score trend for the selected range */}
      <div className="card">
        <p className="font-mono-label" style={{ marginBottom: 'var(--space-md)' }}>
          Distribution Score · {rangedTrend.length >= 2 ? `last ${range}` : 'all time'}
        </p>
        <TrendChart points={chartPoints} />
      </div>

      {(notifications ?? []).length > 0 && (
        <div className="card card--dense">
          <p className="font-mono-label" style={{ marginBottom: 'var(--space-md)' }}>
            Notifications
          </p>
          {(notifications ?? []).map((n) => (
            <div
              key={n.id}
              style={{
                opacity: n.read ? 0.5 : 1,
                borderTop: '1px solid var(--border)',
                padding: 'var(--space-sm) 0',
              }}
            >
              <p className="font-sans-label">{n.title}</p>
              {n.body && <p className="font-mono-micro">{n.body}</p>}
            </div>
          ))}
        </div>
      )}

      <div className="card card--dense">
        <p className="font-mono-label" style={{ marginBottom: 'var(--space-md)' }}>
          Recent activity
        </p>
        {recent && recent.length > 0 ? (
          <table className="w-full" style={{ borderCollapse: 'collapse' }}>
            <tbody>
              {recent.map((s, i) => (
                <tr key={i} style={{ borderTop: '1px solid var(--border)' }}>
                  <td className="font-mono-data" style={{ padding: 'var(--space-sm) 0' }}>
                    {s.platform_id}
                  </td>
                  <td>
                    <span
                      className={
                        ['live', 'indexed'].includes(s.status)
                          ? 'status-live'
                          : ['failed', 'removed'].includes(s.status)
                            ? 'status-dead'
                            : 'status-pending'
                      }
                    >
                      {s.status}
                    </span>
                  </td>
                  <td className="font-mono-micro" style={{ textAlign: 'right' }}>
                    {new Date(s.created_at).toISOString().slice(0, 10)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="font-sans-body">
            Your product is built. Now get it found — install the extension and run your first launch.
          </p>
        )}
      </div>
    </div>
  )
}
