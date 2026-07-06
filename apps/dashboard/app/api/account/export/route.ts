import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * GET /api/account/export — data portability (GDPR Art. 20 / CCPA).
 * Uses the RLS-scoped client so the export can only ever contain the
 * requesting user's own rows, by construction.
 */
export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })

  const [profile, products, campaigns, submissions, scores, queries, checks, notifications, integrations] =
    await Promise.all([
      supabase.from('profiles').select('*').eq('id', user.id).maybeSingle(),
      supabase.from('products').select('*'),
      supabase.from('campaigns').select('*'),
      supabase.from('submissions').select('*'),
      supabase.from('distribution_scores').select('*'),
      supabase.from('visibility_queries').select('*'),
      supabase.from('visibility_checks').select('*'),
      supabase.from('notifications').select('*'),
      supabase.from('integrations').select('kind, created_at'), // webhook URLs excluded: secrets, not personal data
    ])

  const payload = {
    exported_at: new Date().toISOString(),
    profile: profile.data ?? null,
    products: products.data ?? [],
    campaigns: campaigns.data ?? [],
    submissions: submissions.data ?? [],
    distribution_scores: scores.data ?? [],
    visibility_queries: queries.data ?? [],
    visibility_checks: checks.data ?? [],
    notifications: notifications.data ?? [],
    integrations: integrations.data ?? [],
  }

  return new NextResponse(JSON.stringify(payload, null, 2), {
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="usersessions-export-${new Date().toISOString().slice(0, 10)}.json"`,
    },
  })
}
