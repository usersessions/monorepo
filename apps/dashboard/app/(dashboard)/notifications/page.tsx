import { createClient } from '@/lib/supabase/server'
import { PushToggle } from '@/components/PushToggle'
import { markAllRead, markRead } from './actions'

const KIND_COLOR: Record<string, string> = {
  dead_link: 'var(--red)',
  adapter_broken: 'var(--red)',
  score_delta: 'var(--amber)',
  report_ready: 'var(--green)',
  email_verification_needed: 'var(--amber)',
  visibility_change: 'var(--cyan)',
  new_platforms: 'var(--cyan)',
  competitor_scan: 'var(--cyan)',
}

export default async function NotificationsPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>
}) {
  const params = await searchParams
  const supabase = await createClient()

  let query = supabase
    .from('notifications')
    .select('id, kind, title, body, read, created_at')
    .order('created_at', { ascending: false })
    .limit(100)
  if (params.filter === 'unread') query = query.eq('read', false)
  const { data: notifications } = await query

  const unreadCount = (notifications ?? []).filter((n) => !n.read).length

  return (
    <div className="flex flex-col" style={{ gap: 'var(--space-lg)', maxWidth: 720 }}>
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 'var(--space-sm)' }}>
        <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.75rem' }}>Notifications</h1>
        {unreadCount > 0 && (
          <form action={markAllRead}>
            <button className="btn-ghost" type="submit">Mark all as read</button>
          </form>
        )}
      </header>

      <div className="flex" style={{ gap: 'var(--space-sm)' }}>
        <a className="font-mono-label" style={{ color: params.filter !== 'unread' ? 'var(--primary)' : 'var(--muted-2)', textDecoration: 'none' }} href="/notifications">All</a>
        <a className="font-mono-label" style={{ color: params.filter === 'unread' ? 'var(--primary)' : 'var(--muted-2)', textDecoration: 'none' }} href="/notifications?filter=unread">Unread</a>
      </div>

      <PushToggle />

      <div className="card card--dense" aria-live="polite">
        {!notifications || notifications.length === 0 ? (
          <p className="font-sans-body">
            All caught up. We will notify you when your listings go live, go dead, or when AI mentions you.
          </p>
        ) : (
          notifications.map((n) => (
            <div
              key={n.id}
              className="flex"
              style={{
                gap: 'var(--space-md)',
                borderTop: '1px solid var(--border)',
                borderLeft: n.read ? 'none' : '2px solid var(--primary)',
                padding: 'var(--space-sm) var(--space-sm)',
                alignItems: 'flex-start',
              }}
            >
              <span className="font-mono-micro" style={{ color: KIND_COLOR[n.kind] ?? 'var(--muted-2)', minWidth: 90 }}>
                {n.kind.replaceAll('_', ' ')}
              </span>
              <div style={{ flex: 1 }}>
                <p className="font-sans-label" style={{ color: 'var(--paper)', fontWeight: n.read ? 400 : 600 }}>{n.title}</p>
                {n.body && <p className="font-mono-micro">{n.body}</p>}
                <p className="font-mono-micro" style={{ opacity: 0.6 }}>
                  {new Date(n.created_at).toISOString().replace('T', ' ').slice(0, 16)}
                </p>
              </div>
              {!n.read && (
                <form action={markRead}>
                  <input type="hidden" name="id" value={n.id} />
                  <button className="btn-ghost" type="submit" aria-label={`Mark "${n.title}" as read`}>
                    Mark read
                  </button>
                </form>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  )
}
