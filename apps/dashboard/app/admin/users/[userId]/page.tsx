import { notFound } from 'next/navigation'
import { audit, requireAdmin } from '@/lib/admin'
import { createServiceClient } from '@/lib/supabase/server'

/**
 * READ-ONLY "view as" (BUILD_SPEC §12): clearly bannered in --amber, and every view is
 * written to admin_audit_log — this capability is only acceptable if every use is traceable.
 */
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
    .select('id, email, plan, subscription_status, created_at')
    .eq('id', userId)
    .maybeSingle()
  if (!target) notFound()

  await audit(admin.id, 'view_as', userId, null)

  const [{ data: products }, { count: campaignCount }, { data: latestScore }, { data: recentSubs }] =
    await Promise.all([
      db.from('products').select('name, url').eq('user_id', userId),
      db.from('campaigns').select('*', { count: 'exact', head: true }).eq('user_id', userId),
      db.from('distribution_scores').select('score, computed_at').eq('user_id', userId).order('computed_at', { ascending: false }).limit(1).maybeSingle(),
      db.from('submissions').select('platform_id, status, created_at').eq('user_id', userId).order('created_at', { ascending: false }).limit(10),
    ])

  return (
    <div className="flex flex-col" style={{ gap: 'var(--space-lg)' }}>
      <div className="card card--dense" style={{ borderColor: 'var(--amber)' }}>
        <p className="font-mono-label" style={{ color: 'var(--amber)' }}>
          Viewing as {target.email} — Admin Mode · read-only · this view is audit-logged
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3" style={{ gap: 'var(--space-md)' }}>
        <div className="card card--dense">
          <p className="font-mono-label">Distribution Score</p>
          <p className="font-serif-metric">{latestScore?.score ?? '—'}</p>
        </div>
        <div className="card card--dense">
          <p className="font-mono-label">Campaigns</p>
          <p className="font-serif-metric">{campaignCount ?? 0}</p>
        </div>
        <div className="card card--dense">
          <p className="font-mono-label">Plan</p>
          <p className="font-mono-data">{target.plan} · {target.subscription_status}</p>
        </div>
      </div>

      <div className="card card--dense">
        <p className="font-mono-label" style={{ marginBottom: 'var(--space-md)' }}>Products</p>
        {(products ?? []).length === 0 ? (
          <p className="font-sans-body">No products yet.</p>
        ) : (
          (products ?? []).map((p, i) => (
            <p key={i} className="font-mono-data" style={{ padding: 'var(--space-xs) 0' }}>{p.name} · {p.url}</p>
          ))
        )}
      </div>

      <div className="card card--dense">
        <p className="font-mono-label" style={{ marginBottom: 'var(--space-md)' }}>Recent submissions</p>
        {(recentSubs ?? []).map((s, i) => (
          <div key={i} className="flex" style={{ gap: 'var(--space-md)', borderTop: '1px solid var(--border)', padding: 'var(--space-sm) 0' }}>
            <span className="font-mono-data" style={{ flex: 1 }}>{s.platform_id}</span>
            <span className="font-mono-data">{s.status}</span>
            <span className="font-mono-micro">{new Date(s.created_at).toISOString().slice(0, 10)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
