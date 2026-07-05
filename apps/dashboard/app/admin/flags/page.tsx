import { requireAdmin } from '@/lib/admin'
import { createServiceClient } from '@/lib/supabase/server'
import { toggleFlag } from '../actions'

export default async function AdminFlagsPage() {
  await requireAdmin()
  const db = createServiceClient()
  const { data: flags } = await db.from('feature_flags').select('*').order('flag_name')

  return (
    <div className="flex flex-col" style={{ gap: 'var(--space-lg)' }}>
      <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.75rem' }}>Feature flags</h1>
      <p className="font-sans-body">Flags fail closed everywhere: a lookup error is treated as disabled.</p>

      <div className="card card--dense">
        {(flags ?? []).map((f) => (
          <div key={f.flag_name} className="flex items-center" style={{ gap: 'var(--space-md)', borderTop: '1px solid var(--border)', padding: 'var(--space-sm) 0' }}>
            <span className="font-mono-data" style={{ flex: 1 }}>{f.flag_name}</span>
            <span className={f.enabled ? 'status-live' : 'status-pending'}>{f.enabled ? 'on' : 'off'}</span>
            <span className="font-mono-micro">updated {new Date(f.updated_at).toISOString().slice(0, 16).replace('T', ' ')}</span>
            <form action={toggleFlag}>
              <input type="hidden" name="flagName" value={f.flag_name} />
              <input type="hidden" name="enabled" value={String(!f.enabled)} />
              <button className="btn-ghost" type="submit">{f.enabled ? 'Disable' : 'Enable'}</button>
            </form>
          </div>
        ))}
      </div>
    </div>
  )
}
