'use client'

import { useCallback, useEffect, useState } from 'react'
import AdminAlertItem, { type AdminAlert } from './AdminAlertItem'

// Sticky, collapsible alert feed. Polls every 5s so a test alert lands within
// the Alert Gate window. Renders nothing when there is nothing to say.
export default function AdminAlertFeed() {
  const [alerts, setAlerts] = useState<AdminAlert[]>([])
  const [open, setOpen] = useState(true)

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/alerts')
      if (!res.ok) return
      const body = (await res.json()) as { alerts?: AdminAlert[] }
      setAlerts(body.alerts ?? [])
    } catch {
      // keep last known state; next poll retries
    }
  }, [])

  useEffect(() => {
    void load()
    const id = setInterval(() => void load(), 5000)
    return () => clearInterval(id)
  }, [load])

  async function dismiss(id: string) {
    setAlerts((all) => all.filter((a) => a.id !== id))
    await fetch('/api/admin/alerts', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id }),
    }).catch(() => {})
  }

  if (alerts.length === 0) return null

  const hasCritical = alerts.some((a) => a.severity === 'critical')
  return (
    <div style={{ position: 'sticky', top: 0, zIndex: 20 }}>
      <div className="card card--dense" style={{ borderColor: hasCritical ? 'var(--red)' : 'var(--border)' }}>
        <button
          type="button"
          className="font-mono-label"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          style={{ background: 'transparent', border: 'none', color: 'inherit', cursor: 'pointer', padding: 0 }}
        >
          Alerts ({alerts.length}) {open ? '▾' : '▸'}
        </button>
        {open ? (
          <div className="flex flex-col" style={{ marginTop: 'var(--space-sm)' }}>
            {alerts.map((a) => (
              <AdminAlertItem key={a.id} alert={a} onDismiss={dismiss} />
            ))}
          </div>
        ) : null}
      </div>
    </div>
  )
}
