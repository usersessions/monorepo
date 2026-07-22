import { requireAdmin } from '@/lib/admin'
import { createServiceClient } from '@/lib/supabase/server'

const fmt = (iso: string) => new Date(iso).toISOString().replace('T', ' ').slice(0, 16)
const THREE_DAYS_MS = 3 * 864e5

export default async function AdminCompliancePage() {
  await requireAdmin()
  const db = createServiceClient()

  const [{ data: gdpr }, { data: securityAlerts }, { data: complianceFlags }] = await Promise.all([
    db
      .from('gdpr_requests')
      .select('id, request_type, status, admin_notes, created_at, completed_at, profiles(email)')
      .order('created_at', { ascending: false })
      .limit(100),
    db
      .from('admin_notifications')
      .select('id, title, body, severity, created_at')
      .eq('kind', 'security_alert')
      .order('created_at', { ascending: false })
      .limit(20),
    db
      .from('admin_notifications')
      .select('id, title, body, severity, created_at')
      .eq('kind', 'compliance_flag')
      .order('created_at', { ascending: false })
      .limit(20),
  ])

  const now = Date.now()
  const overdue = (gdpr ?? []).filter((r) => r.status === 'pending' && now - new Date(r.created_at).getTime() > THREE_DAYS_MS)

  return (
    <div className="flex flex-col" style={{ gap: 'var(--space-lg)' }}>
      <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.75rem' }}>Compliance</h1>

      {overdue.length > 0 ? (
        <div className="card card--dense" style={{ borderLeft: '3px solid var(--amber)' }}>
          <p className="font-sans-body">
            {overdue.length} GDPR request{overdue.length === 1 ? '' : 's'} pending for more than 3 days — statutory clocks are running.
          </p>
        </div>
      ) : null}

      <div className="card card--dense" style={{ overflowX: 'auto' }}>
        <p className="font-mono-label" style={{ marginBottom: 'var(--space-md)' }}>GDPR requests</p>
        {(gdpr ?? []).length === 0 ? (
          <p className="font-sans-body">No GDPR requests on file.</p>
        ) : (
          <>
            <div className="flex font-mono-micro" style={{ gap: 'var(--space-md)', padding: 'var(--space-sm) 0', color: 'var(--muted)', minWidth: 720 }}>
              <span style={{ width: 200 }}>User</span>
              <span style={{ width: 100 }}>Type</span>
              <span style={{ width: 100 }}>Status</span>
              <span style={{ width: 130 }}>Requested (UTC)</span>
              <span style={{ width: 130 }}>Completed (UTC)</span>
            </div>
            {(gdpr ?? []).map((r) => {
              const email = (r.profiles as { email?: string } | null)?.email ?? '—'
              const isOverdue = r.status === 'pending' && now - new Date(r.created_at).getTime() > THREE_DAYS_MS
              return (
                <div key={r.id} className="flex" style={{ gap: 'var(--space-md)', borderTop: '1px solid var(--border)', padding: 'var(--space-sm) 0', alignItems: 'center', minWidth: 720 }}>
                  <span className="font-mono-micro" style={{ width: 200, overflow: 'hidden', textOverflow: 'ellipsis' }}>{email}</span>
                  <span className="font-mono-micro" style={{ width: 100 }}>{r.request_type}</span>
                  <span className={r.status === 'completed' ? 'status-live' : r.status === 'rejected' ? 'status-dead' : 'status-pending'} style={{ width: 100, ...(isOverdue ? { color: 'var(--amber)' } : {}) }}>
                    {r.status}{isOverdue ? ' ⚠' : ''}
                  </span>
                  <span className="font-mono-micro" style={{ width: 130 }}>{fmt(r.created_at)}</span>
                  <span className="font-mono-micro" style={{ width: 130 }}>{r.completed_at ? fmt(r.completed_at) : '—'}</span>
                </div>
              )
            })}
          </>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2" style={{ gap: 'var(--space-md)' }}>
        <div className="card card--dense">
          <p className="font-mono-label" style={{ marginBottom: 'var(--space-md)' }}>Security incidents</p>
          {(securityAlerts ?? []).length === 0 ? (
            <p className="font-sans-body">No security alerts recorded.</p>
          ) : (
            (securityAlerts ?? []).map((a) => (
              <div key={a.id} style={{ borderTop: '1px solid var(--border)', padding: 'var(--space-sm) 0' }}>
                <p className="font-sans-label" style={{ fontWeight: 600 }}>{a.title}</p>
                {a.body ? <p className="font-sans-body">{a.body}</p> : null}
                <p className="font-mono-micro">{fmt(a.created_at)} · {a.severity}</p>
              </div>
            ))
          )}
        </div>

        <div className="card card--dense">
          <p className="font-mono-label" style={{ marginBottom: 'var(--space-md)' }}>Compliance flags</p>
          {(complianceFlags ?? []).length === 0 ? (
            <p className="font-sans-body">No compliance flags raised.</p>
          ) : (
            (complianceFlags ?? []).map((a) => (
              <div key={a.id} style={{ borderTop: '1px solid var(--border)', padding: 'var(--space-sm) 0' }}>
                <p className="font-sans-label" style={{ fontWeight: 600 }}>{a.title}</p>
                {a.body ? <p className="font-sans-body">{a.body}</p> : null}
                <p className="font-mono-micro">{fmt(a.created_at)} · {a.severity}</p>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="card card--dense">
        <p className="font-mono-label" style={{ marginBottom: 'var(--space-md)' }}>Data retention</p>
        <p className="font-sans-body">
          Account deletion cascades through profiles (videos, notifications, tickets).
          Revenue events and admin audit logs are append-only and retained for financial and security accountability.
          GDPR deletion requests above must be completed within 30 days of receipt.
        </p>
      </div>
    </div>
  )
}
