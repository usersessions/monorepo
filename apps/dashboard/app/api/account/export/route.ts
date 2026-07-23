import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Force dynamic: Supabase URL is a runtime env var on Cloudflare, not a build var.
export const dynamic = 'force-dynamic'


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

  const [profile, videos, notifications, integrations] =
    await Promise.all([
      supabase.from('profiles').select('*').eq('id', user.id).maybeSingle(),
      supabase.from('videos').select('*'),
      supabase.from('notifications').select('*'),
      supabase.from('integrations').select('kind, created_at'), // webhook URLs excluded: secrets, not personal data
    ])

  const payload = {
    exported_at: new Date().toISOString(),
    profile: profile.data ?? null,
    videos: videos.data ?? [],
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
