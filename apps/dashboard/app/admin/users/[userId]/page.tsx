import { notFound } from 'next/navigation'
import { audit, requireAdmin } from '@/lib/admin'
import { createServiceClient } from '@/lib/supabase/server'
import { limitsFor } from '@/lib/tiers'
import { setPlan, setSubscriptionStatus } from '../../actions'

export default async function AdminViewAsPage({
  params,
}: {
  params: Promise<{ userId: string }>
}) {
  const { user: admin } = await requireAdmin()
  const { userId } = await params
  const db = createServiceClient()

  const { data: target } = await db
    .from('profiles')
    .select('id, email, plan, subscription_status, role, created_at')
    .eq('id', userId)
    .maybeSingle()
  if (!target) notFound()

  await audit(admin.id, 'view_as', userId, null)

  const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()

  const [{ count: videoTotal }, { count: videosThisMonth }, { data: recentVideos }] =
    await Promise.all([
      db.from('videos').select('*', { count: 'exact', head: true }).eq('user_id', userId),
      db.from('videos').select('*', { count: 'exact', head: true }).eq('user_id', userId).gte('created_at', startOfMonth),
      db.from('videos').select('id, title, status, created_at').eq('user_id', userId).order('created_at', { ascending: false }).limit(10),
    ])

  const planLimits = limitsFor(target.plan)
  const creditsUsed = videosThisMonth ?? 0
  const creditsTotal = planLimits.videosPerMonth

  return (
    <div className="flex flex-col" style={{ gap: 'var(--space-lg)' }}>
      <div className="card card--dense" style={{ borderColor: 'var(--amber)' }}>
        <p className="font-mono-label" style={{ color: 'var(--amber)' }}>
          Admin view — {target.email} · all actions are audit-logged
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3" style={{ gap: 'var(--space-md)' }}>
        <div className="card card--dense">
          <p className="font-mono-label">Total Videos</p>
          <p className="font-serif-metric">{videoTotal ?? 0}</p>
        </div>
        <div className="card card--dense">
          <p className="font-mono-label">This Month</p>
          <p className="font-serif-metric">{creditsUsed} / {creditsTotal}</p>
        </div>
        <div className="card card--dense">
          <p className="font-mono-label">Plan</p>
          <p className="font-mono-data">{target.plan} · {target.subscription_status}</p>
        </div>
      </div>

      {/* Plan Override */}
      <div className="card card--dense flex flex-col" style={{ gap: 'var(--space-md)' }}>
        <p className="font-mono-label">Override Plan</p>
        <form action={setPlan} className="flex" style={{ gap: 'var(--space-xs)', flexWrap: 'wrap' }}>
          <input type="hidden" name="userId" value={target.id} />
          <select name="plan" defaultValue={target.plan} className="input-field" style={{ width: 'auto' }}>
            {['free', 'starter', 'pro', 'agency'].map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
          <button className="btn-ghost" type="submit">Set plan</button>
        </form>

        <form action={setSubscriptionStatus} className="flex" style={{ gap: 'var(--space-xs)', flexWrap: 'wrap' }}>
          <input type="hidden" name="userId" value={target.id} />
          <select name="status" defaultValue={target.subscription_status ?? 'none'} className="input-field" style={{ width: 'auto' }}>
            {['none', 'active', 'non_renewing', 'attention', 'cancelled'].map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <button className="btn-ghost" type="submit">Set status</button>
        </form>
      </div>

      {/* Recent Videos */}
      <div className="card card--dense">
        <p className="font-mono-label" style={{ marginBottom: 'var(--space-md)' }}>Recent videos</p>
        {(recentVideos ?? []).length === 0 ? (
          <p className="font-sans-body">No videos yet.</p>
        ) : (
          (recentVideos ?? []).map((v, i) => (
            <div key={i} className="flex" style={{ gap: 'var(--space-md)', borderTop: '1px solid var(--border)', padding: 'var(--space-sm) 0', flexWrap: 'wrap' }}>
              <span className="font-mono-data" style={{ flex: 1 }}>{v.title || v.id}</span>
              <span className="font-mono-data">{v.status}</span>
              <span className="font-mono-micro">{new Date(v.created_at).toISOString().slice(0, 10)}</span>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
