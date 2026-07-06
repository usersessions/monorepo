import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

function csvField(value: unknown): string {
  const s = value == null ? '' : String(value)
  return `"${s.replaceAll('"', '""')}"`
}

/** GET /api/listings/export — CSV of the user's own submissions (RLS-scoped). */
export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })

  const [{ data: subs }, { data: platforms }] = await Promise.all([
    supabase
      .from('submissions')
      .select('platform_id, status, listing_url, simulated, created_at')
      .order('created_at', { ascending: false }),
    supabase.from('platforms').select('id, name, category'),
  ])

  const platformById = new Map((platforms ?? []).map((p) => [p.id, p]))
  const header = ['platform', 'category', 'status', 'listing_url', 'simulated', 'submitted_at']
  const lines = [header.join(',')]
  for (const s of subs ?? []) {
    const p = platformById.get(s.platform_id)
    lines.push(
      [
        csvField(p?.name ?? s.platform_id),
        csvField(p?.category ?? ''),
        csvField(s.status),
        csvField(s.listing_url ?? ''),
        csvField(s.simulated ? 'yes' : 'no'),
        csvField(s.created_at),
      ].join(',')
    )
  }

  return new NextResponse(lines.join('\n'), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="listings-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  })
}
