import { requireAdmin } from '@/lib/admin'
import { createServiceClient } from '@/lib/supabase/server'

const STATUS_CLS: Record<string, string> = {
  open: 'status-pending',
  pending: 'status-pending',
  resolved: 'status-live',
  closed: 'font-mono-micro',
}

const PRIORITY_COLOR: Record<string, string> = {
  urgent: 'var(--red)',
  high: 'var(--amber)',
  normal: 'var(--muted)',
  low: 'var(--muted)',
}

const fmt = (iso: string) => new Date(iso).toISOString().replace('T', ' ').slice(0, 16)

export default async function AdminSupportPage() {
  await requireAdmin()
  const db = createServiceClient()

  const [{ data: tickets }, { count: openCount }, { count: pendingCount }, { count: resolvedCount }] = await Promise.all([
    db
      .from('support_tickets')
      .select('id, subject, status, priority, created_at, updated_at, profiles(email)')
      .order('created_at', { ascending: false })
      .limit(100),
    db.from('support_tickets').select('*', { count: 'exact', head: true }).eq('status', 'open'),
    db.from('support_tickets').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
    db.from('support_tickets').select('*', { count: 'exact', head: true }).eq('status', 'resolved'),
  ])

  const cards = [
    { label: 'Open', value: openCount ?? 0 },
    { label: 'Pending', value: pendingCount ?? 0 },
    { label: 'Resolved', value: resolvedCount ?? 0 },
  ]

  return (
    <div className="flex flex-col" style={{ gap: 'var(--space-lg)' }}>
      <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.75rem' }}>Support</h1>

      <div className="grid grid-cols-1 md:grid-cols-3" style={{ gap: 'var(--space-md)' }}>
        {cards.map((c) => (
          <div key={c.label} className="card card--dense">
            <p className="font-mono-label">{c.label}</p>
            <p className="font-serif-metric">{c.value}</p>
          </div>
        ))}
      </div>

      <div className="card card--dense" style={{ overflowX: 'auto' }}>
        <p className="font-mono-label" style={{ marginBottom: 'var(--space-md)' }}>Tickets</p>
        {(tickets ?? []).length === 0 ? (
          <p className="font-sans-body">No support tickets yet. Tickets created by users land here.</p>
        ) : (
          <>
            <div className="flex font-mono-micro" style={{ gap: 'var(--space-md)', padding: 'var(--space-sm) 0', color: 'var(--muted)', minWidth: 720 }}>
              <span style={{ flex: 1, minWidth: 200 }}>Subject</span>
              <span style={{ width: 200 }}>User</span>
              <span style={{ width: 70 }}>Priority</span>
              <span style={{ width: 80 }}>Status</span>
              <span style={{ width: 130 }}>Created (UTC)</span>
            </div>
            {(tickets ?? []).map((t) => {
              const email = (t.profiles as { email?: string } | null)?.email ?? '—'
              return (
                <div key={t.id} className="flex" style={{ gap: 'var(--space-md)', borderTop: '1px solid var(--border)', padding: 'var(--space-sm) 0', alignItems: 'center', minWidth: 720 }}>
                  <span className="font-sans-label" style={{ flex: 1, minWidth: 200 }}>{t.subject}</span>
                  <span className="font-mono-micro" style={{ width: 200, overflow: 'hidden', textOverflow: 'ellipsis' }}>{email}</span>
                  <span className="font-mono-micro" style={{ width: 70, color: PRIORITY_COLOR[t.priority] ?? 'var(--muted)' }}>{t.priority}</span>
                  <span className={STATUS_CLS[t.status] ?? 'font-mono-micro'} style={{ width: 80 }}>{t.status}</span>
                  <span className="font-mono-micro" style={{ width: 130 }}>{fmt(t.created_at)}</span>
                </div>
              )
            })}
          </>
        )}
      </div>
    </div>
  )
}
