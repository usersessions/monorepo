'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import ExportModal from './ExportModal'
import ImpersonateModal from './ImpersonateModal'

function logAction(action: string, detail?: unknown) {
  void fetch('/api/admin/quick-action', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ action, detail }),
  }).catch(() => {})
}

// Common admin operations, one click away. Every action is audit-logged.
export default function QuickActionsBar() {
  const router = useRouter()
  const [modal, setModal] = useState<'impersonate' | 'export' | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  function say(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 5000)
  }

  async function runAdapterCheck() {
    logAction('adapter_check')
    say('Running platform-quality check…')
    try {
      const res = await fetch('/api/admin/cron/trigger', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ job: 'platform-quality' }),
      })
      say(res.ok ? 'Adapter check completed.' : 'Adapter check failed — see cron table.')
    } catch {
      say('Adapter check failed — network error.')
    }
    router.refresh()
  }

  async function securityCheck() {
    logAction('security_check')
    try {
      const res = await fetch('/api/admin/health')
      if (!res.ok) throw new Error()
      const { health } = (await res.json()) as { health: Record<string, { status: string }> }
      const attention = Object.entries(health).filter(([, v]) => v.status !== 'live').map(([k]) => k)
      say(attention.length === 0 ? 'Security check: all systems nominal.' : `Attention needed: ${attention.join(', ')}`)
    } catch {
      say('Security check failed to run.')
    }
  }

  return (
    <>
      <div className="flex" style={{ gap: 'var(--space-sm)', flexWrap: 'wrap' }}>
        <button className="btn-ghost" type="button" onClick={() => { logAction('impersonate_open'); setModal('impersonate') }}>Impersonate user</button>
        <button className="btn-ghost" type="button" onClick={() => { logAction('flags_open'); router.push('/admin/flags') }}>Toggle feature flag</button>
        <button className="btn-ghost" type="button" onClick={runAdapterCheck}>Run adapter check</button>
        <button className="btn-ghost" type="button" onClick={() => { logAction('export_open'); setModal('export') }}>Export data</button>
        <button className="btn-ghost" type="button" onClick={() => { logAction('refresh_all'); router.refresh(); say('Data refreshed.') }}>Refresh all</button>
        <button className="btn-ghost" type="button" onClick={securityCheck}>Security check</button>
      </div>
      {toast ? <p className="font-mono-micro" role="status" style={{ color: 'var(--amber)' }}>{toast}</p> : null}
      {modal === 'impersonate' ? <ImpersonateModal onClose={() => setModal(null)} /> : null}
      {modal === 'export' ? <ExportModal onClose={() => setModal(null)} /> : null}
    </>
  )
}
