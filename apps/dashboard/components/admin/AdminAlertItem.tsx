'use client'

export type AdminAlert = {
  id: string
  kind: string
  severity: 'info' | 'warning' | 'critical'
  title: string
  body: string | null
  metadata: { href?: string } | null
  created_at: string
}

const COLOR: Record<AdminAlert['severity'], string> = {
  info: 'var(--cyan, #22d3ee)',
  warning: 'var(--amber)',
  critical: 'var(--red)',
}

function rel(iso: string): string {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (s < 60) return 'just now'
  if (s < 3600) return `${Math.floor(s / 60)} min ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  return `${Math.floor(s / 86400)}d ago`
}

export default function AdminAlertItem({ alert, onDismiss }: { alert: AdminAlert; onDismiss: (id: string) => void }) {
  return (
    <div className="flex" style={{ gap: 'var(--space-md)', alignItems: 'flex-start', borderTop: '1px solid var(--border)', padding: 'var(--space-sm) 0' }}>
      <span aria-hidden="true" style={{ width: 8, height: 8, borderRadius: '50%', background: COLOR[alert.severity], marginTop: 5, flexShrink: 0 }} />
      <div style={{ flex: 1 }}>
        <p className="font-sans-label" style={{ fontWeight: 600 }}>{alert.title}</p>
        {alert.body ? <p className="font-sans-body">{alert.body}</p> : null}
        <p className="font-mono-micro" suppressHydrationWarning>
          {rel(alert.created_at)}
          {alert.metadata?.href ? (
            <>
              {' · '}
              <a href={alert.metadata.href} style={{ color: 'inherit' }}>View details</a>
            </>
          ) : null}
        </p>
      </div>
      <button className="btn-ghost" type="button" aria-label={`Dismiss: ${alert.title}`} onClick={() => onDismiss(alert.id)}>
        ✕
      </button>
    </div>
  )
}
