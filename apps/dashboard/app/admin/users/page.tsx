import Link from 'next/link'
import { requireAdmin } from '@/lib/admin'
import { createServiceClient } from '@/lib/supabase/server'
import { setPlan, setSubscriptionStatus } from '../actions'

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>
}) {
  await requireAdmin()
  const { q } = await searchParams
  const db = createServiceClient()

  let query = db
    .from('profiles')
    .select('id, email, plan, subscription_status, role, created_at')
    .order('created_at', { ascending: false })
    .limit(50)
  if (q) query = query.ilike('email', `%${q}%`)
  const { data: users } = await query

  return (
    <div className="flex flex-col" style={{ gap: 'var(--space-lg)' }}>
      <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.75rem' }}>Users</h1>

      <form method="get" className="flex" style={{ gap: 'var(--space-sm)' }}>
        <input name="q" defaultValue={q ?? ''} placeholder="search email" className="input-field" style={{ maxWidth: 280 }} />
        <button className="btn-ghost" type="submit">Search</button>
      </form>

      <div className="card card--dense">
        {(users ?? []).map((u) => (
          <div key={u.id} className="flex items-center" style={{ gap: 'var(--space-md)', borderTop: '1px solid var(--border)', padding: 'var(--space-sm) 0', flexWrap: 'wrap' }}>
            <span className="font-mono-data" style={{ flex: 1, minWidth: 200 }}>
              {u.email} {u.role === 'admin' && <span className="font-mono-micro" style={{ color: 'var(--amber)' }}>admin</span>}
            </span>

            {/* Plan override — audited */}
            <form action={setPlan} className="flex" style={{ gap: 'var(--space-xs)' }}>
              <input type="hidden" name="userId" value={u.id} />
              <select name="plan" defaultValue={u.plan} className="input-field" style={{ width: 'auto' }}>
                {['free', 'founder', 'agency'].map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
              <button className="btn-ghost" type="submit">Set plan</button>
            </form>

            {/* Subscription status override (incl. suspension) — audited */}
            <form action={setSubscriptionStatus} className="flex" style={{ gap: 'var(--space-xs)' }}>
              <input type="hidden" name="userId" value={u.id} />
              <select name="status" defaultValue={u.subscription_status} className="input-field" style={{ width: 'auto' }}>
                {['none', 'active', 'non_renewing', 'attention', 'cancelled'].map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
              <button className="btn-ghost" type="submit">Set status</button>
            </form>

            <Link className="font-mono-micro" style={{ color: 'var(--primary)' }} href={`/admin/users/${u.id}`}>
              view as →
            </Link>
          </div>
        ))}
      </div>
    </div>
  )
}
