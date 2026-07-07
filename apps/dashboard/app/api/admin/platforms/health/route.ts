import { NextResponse } from 'next/server'
import { requireAdminApi } from '@/lib/admin-api'
import { createServiceClient } from '@/lib/supabase/server'

// Latest platform_health snapshots (client-side refresh consumers).
export async function GET() {
  const user = await requireAdminApi()
  if (!user) return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 })

  const db = createServiceClient()
  const { data } = await db
    .from('platform_health')
    .select('platform_id, status, last_check_at, avg_response_ms, error_rate, adapter_version')
    .order('last_check_at', { ascending: false })
    .limit(500)
  return NextResponse.json({ health: data ?? [], generatedAt: new Date().toISOString() })
}
