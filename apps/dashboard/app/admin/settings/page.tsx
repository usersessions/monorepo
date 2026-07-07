import Link from 'next/link'
import { requireAdmin } from '@/lib/admin'
import { createServiceClient } from '@/lib/supabase/server'
import EmailTestButton from '@/components/admin/EmailTestButton'

export default async function AdminSettingsPage() {
  await requireAdmin()
  const db = createServiceClient()
  const { data: flags } = await db.from('feature_flags').select('flag_name, enabled').order('flag_name')

  // Presence checks only — never render secret values.
  const integrations = [
    { name: 'Supabase', configured: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY), detail: 'Database, auth, realtime' },
    { name: 'Paystack (billing)', configured: Boolean(process.env.PAYSTACK_SECRET_KEY), detail: 'Subscriptions and webhooks' },
    { name: 'Resend (email)', configured: Boolean(process.env.RESEND_API_KEY), detail: 'Digest and notification email' },
    { name: 'Gemini (AI copy)', configured: Boolean(process.env.GEMINI_API_KEY), detail: 'Submission copy generation' },
    { name: 'Cron scheduler', configured: Boolean(process.env.CRON_SECRET), detail: 'Fail-closed bearer auth on /api/cron/*' },
  ]

  return (
    <div className="flex flex-col" style={{ gap: 'var(--space-lg)' }}>
      <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.75rem' }}>Settings</h1>

      <div className="card card--dense">
        <p className="font-mono-label" style={{ marginBottom: 'var(--space-md)' }}>Integration status</p>
        {integrations.map((i) => (
          <div key={i.name} className="flex" style={{ gap: 'var(--space-md)', borderTop: '1px solid var(--border)', padding: 'var(--space-sm) 0', alignItems: 'center' }}>
            <span className="font-sans-label" style={{ flex: 1, fontWeight: 600 }}>{i.name}</span>
            <span className="font-mono-micro" style={{ flex: 1 }}>{i.detail}</span>
            <span className={i.configured ? 'status-live' : 'status-dead'}>{i.configured ? 'configured' : 'missing'}</span>
          </div>
        ))}
      </div>

      <div className="card card--dense">
        <p className="font-mono-label" style={{ marginBottom: 'var(--space-md)' }}>Email delivery</p>
        <p className="font-sans-body" style={{ marginBottom: 'var(--space-md)' }}>
          Sends a test message to your admin address through the Resend wrapper (fail-soft, audit-logged).
        </p>
        <EmailTestButton />
      </div>

      <div className="card card--dense">
        <p className="font-mono-label" style={{ marginBottom: 'var(--space-md)' }}>Feature flags</p>
        {(flags ?? []).length === 0 ? (
          <p className="font-sans-body">No feature flags defined.</p>
        ) : (
          (flags ?? []).map((f) => (
            <div key={f.flag_name} className="flex" style={{ gap: 'var(--space-md)', borderTop: '1px solid var(--border)', padding: 'var(--space-sm) 0', alignItems: 'center' }}>
              <span className="font-mono-data" style={{ flex: 1 }}>{f.flag_name}</span>
              <span className={f.enabled ? 'status-live' : 'font-mono-micro'}>{f.enabled ? 'enabled' : 'disabled'}</span>
            </div>
          ))
        )}
        <p className="font-mono-micro" style={{ marginTop: 'var(--space-md)' }}>
          Toggle flags on the <Link href="/admin/flags" style={{ color: 'inherit' }}>Flags page</Link>.
        </p>
      </div>

      <div className="card card--dense">
        <p className="font-mono-label" style={{ marginBottom: 'var(--space-md)' }}>Insight thresholds</p>
        <p className="font-sans-body">
          Current anomaly thresholds (defined in <span className="font-mono-data">lib/insights.ts</span>): cron stale after 48h,
          queue warning above 10 and critical above 50, adapter backlog above 20, signup spike/drop at 2x / 0.5x of the 7-day average.
          Making these editable here is the designated follow-up once they prove out.
        </p>
      </div>
    </div>
  )
}
