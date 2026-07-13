import { requireAdmin } from '@/lib/admin'
import { createServiceClient } from '@/lib/supabase/server'
import type { PlatformRequestStatus } from '@usersessions/shared'
import { setPlatformRequestStatus } from '../actions'

const STATUSES: PlatformRequestStatus[] = ['pending', 'under_review', 'approved', 'rejected', 'shipped']
const STATUS_COLOR: Record<PlatformRequestStatus, string> = {
  pending: 'var(--muted-2)',
  under_review: 'var(--cyan)',
  approved: 'var(--green)',
  rejected: 'var(--red)',
  shipped: 'var(--primary)',
}

/**
 * All platform requests, sorted by votes. Approve/reject/ship write status + admin_audit_log
 * only (requester notification email is a documented deferral — no template/schema exists yet).
 */
export default async function AdminPlatformRequestsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>
}) {
  await requireAdmin()
  const params = await searchParams
  const db = createServiceClient()

  let query = db.from('platform_requests').select('*').order('vote_count', { ascending: false }).limit(200)
  if (params.status && STATUSES.includes(params.status as PlatformRequestStatus)) {
    query = query.eq('status', params.status)
  }
  const { data: requests, error } = await query

  const requesterIds = [...new Set((requests ?? []).map((r) => r.requester_id).filter(Boolean))] as string[]
  const { data: requesters } = requesterIds.length
    ? await db.from('profiles').select('id, email').in('id', requesterIds)
    : { data: [] as { id: string; email: string }[] }
  const emailById = new Map((requesters ?? []).map((r) => [r.id, r.email]))

  return (
    <div className="flex flex-col" style={{ gap: 'var(--space-lg)' }}>
      <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.75rem' }}>Platform requests</h1>
      <p className="font-sans-body">Sorted by votes. Requester notification email is not yet wired — status changes are recorded here and in the audit log only.</p>

      <div className="flex" style={{ gap: 'var(--space-sm)', flexWrap: 'wrap' }}>
        <a href="/admin/platform-requests" className={!params.status ? 'btn-primary' : 'btn-ghost'} style={{ textDecoration: 'none' }}>All</a>
        {STATUSES.map((s) => (
          <a key={s} href={`/admin/platform-requests?status=${s}`} className={params.status === s ? 'btn-primary' : 'btn-ghost'} style={{ textDecoration: 'none' }}>
            {s.replace('_', ' ')}
          </a>
        ))}
      </div>

      {error ? (
        <div className="card" style={{ borderColor: 'var(--amber)' }}>
          <p className="font-mono-label" style={{ color: 'var(--amber)' }}>Platform requests table not found</p>
          <p className="font-sans-body">Migration 0035_platform_requests has not been applied to this database yet.</p>
        </div>
      ) : (requests ?? []).length === 0 ? (
        <div className="card"><p className="font-sans-body">No requests yet. Be the first to suggest a platform.</p></div>
      ) : (
        <div className="card card--dense flex flex-col">
          {(requests ?? []).map((r) => (
            <details key={r.id} style={{ borderTop: '1px solid var(--border)', padding: 'var(--space-sm) 0' }}>
              <summary style={{ cursor: 'pointer', display: 'flex', gap: 'var(--space-md)', alignItems: 'center', flexWrap: 'wrap' }}>
                <span className="font-mono-data" style={{ width: 50 }}>▲ {r.vote_count}</span>
                <span className="font-sans-label" style={{ flex: 1, color: 'var(--paper)' }}>{r.name}</span>
                <span className="font-mono-micro" style={{ width: 100 }}>{r.category}</span>
                <span className="font-mono-micro" style={{ width: 120, color: STATUS_COLOR[r.status as PlatformRequestStatus] }}>{String(r.status).replace('_', ' ')}</span>
                <span className="font-mono-micro" style={{ width: 100 }}>{new Date(r.created_at).toISOString().slice(0, 10)}</span>
              </summary>
              <div className="flex flex-col" style={{ gap: 'var(--space-sm)', marginTop: 'var(--space-sm)', paddingLeft: 62 }}>
                {r.url && (
                  <a href={r.url} target="_blank" rel="noreferrer" className="font-mono-micro" style={{ color: 'var(--primary)' }}>{r.url} ↗</a>
                )}
                <p className="font-sans-body">{r.description || 'No description provided.'}</p>
                <p className="font-mono-micro">
                  Requester: {r.requester_id ? (emailById.get(r.requester_id) ?? r.requester_id) : 'unknown'}
                </p>
                <form action={setPlatformRequestStatus} className="flex" style={{ gap: 'var(--space-sm)', flexWrap: 'wrap' }}>
                  <input type="hidden" name="requestId" value={r.id} />
                  {STATUSES.filter((s) => s !== r.status).map((s) => (
                    <button key={s} className="btn-ghost" type="submit" name="status" value={s}>
                      {s === 'approved' ? 'Approve' : s === 'rejected' ? 'Reject' : s === 'shipped' ? 'Mark shipped' : s.replace('_', ' ')}
                    </button>
                  ))}
                </form>
              </div>
            </details>
          ))}
        </div>
      )}
    </div>
  )
}
