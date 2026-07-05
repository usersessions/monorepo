import { NextResponse } from 'next/server'
import { authenticateBearer } from '@/lib/auth/bearer'
import { createServiceClient } from '@/lib/supabase/server'
import type { TelemetryBatch } from '@usersessions/shared'

/**
 * POST /api/telemetry/ai-edits — fire-and-forget on the extension side, equally forgiving here:
 * catch everything, ALWAYS return 200. A telemetry hiccup must never surface as a user-facing
 * failure anywhere (BUILD_SPEC §7).
 */
export async function POST(request: Request) {
  try {
    const user = await authenticateBearer(request)
    if (user) {
      const batch = (await request.json()) as TelemetryBatch
      if (Array.isArray(batch?.entries) && batch.entries.length > 0) {
        const db = createServiceClient()
        await db.from('edits_telemetry').insert(
          batch.entries.slice(0, 100).map((e) => ({
            user_id: user.id,
            platform_category: e.platformCategory,
            original_hook: e.originalHook ?? null,
            edited_hook: e.editedHook ?? null,
            original_body: e.originalBody ?? null,
            edited_body: e.editedBody ?? null,
            was_edited: e.wasEdited,
          }))
        )
      }
    }
  } catch (err) {
    console.error('[telemetry] swallowed error:', err)
  }
  return NextResponse.json({ ok: true })
}
