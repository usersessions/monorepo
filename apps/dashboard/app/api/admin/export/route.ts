import { NextResponse } from 'next/server'
import { audit } from '@/lib/admin'
import { requireAdminApi } from '@/lib/admin-api'
import { createServiceClient } from '@/lib/supabase/server'

const LIMIT = 5000

const DATASETS: Record<string, { table: string; columns: string; order: string }> = {
  users: { table: 'profiles', columns: 'id, email, full_name, role, plan, subscription_status, created_at', order: 'created_at' },
  revenue: { table: 'revenue_events', columns: 'id, user_id, event_type, amount, currency, paystack_reference, created_at', order: 'created_at' },
  cron_logs: { table: 'cron_logs', columns: 'id, job_name, status, ran_at', order: 'ran_at' },
  audit: { table: 'admin_audit_log', columns: '*', order: 'created_at' },
  platform_health: { table: 'platform_health', columns: 'platform_id, status, last_check_at, avg_response_ms, error_rate, adapter_version', order: 'last_check_at' },
  support_tickets: { table: 'support_tickets', columns: 'id, user_id, subject, status, priority, created_at', order: 'created_at' },
}

function toCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return ''
  const headers = Object.keys(rows[0])
  const esc = (v: unknown) => {
    const s = v === null || v === undefined ? '' : typeof v === 'object' ? JSON.stringify(v) : String(v)
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  return [headers.join(','), ...rows.map((r) => headers.map((h) => esc(r[h])).join(','))].join('\n')
}

// Dataset export, CSV or JSON, capped at 5000 rows. Larger async exports with
// email delivery can build on this once needed.
export async function GET(request: Request) {
  const user = await requireAdminApi()
  if (!user) return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 })

  const params = new URL(request.url).searchParams
  const dataset = params.get('dataset') ?? ''
  const format = params.get('format') === 'json' ? 'json' : 'csv'
  const def = DATASETS[dataset]
  if (!def) return NextResponse.json({ error: 'UNKNOWN_DATASET' }, { status: 400 })

  const db = createServiceClient()
  const { data, error } = await db.from(def.table).select(def.columns).order(def.order, { ascending: false }).limit(LIMIT)
  if (error) return NextResponse.json({ error: 'QUERY_FAILED' }, { status: 500 })

  const rows = (data ?? []) as unknown as Record<string, unknown>[]
  await audit(user.id, 'data_export', null, { dataset, format, rows: rows.length })

  const stamp = new Date().toISOString().slice(0, 10)
  if (format === 'json') {
    return new NextResponse(JSON.stringify(rows, null, 2), {
      headers: {
        'content-type': 'application/json',
        'content-disposition': `attachment; filename="${dataset}-${stamp}.json"`,
      },
    })
  }
  return new NextResponse(toCsv(rows), {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="${dataset}-${stamp}.csv"`,
    },
  })
}
