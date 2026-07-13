import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { FeatureEventInput, FeatureName, FeatureEventType } from '@usersessions/shared'

/**
 * POST /api/events — append one feature-usage event.
 * ALWAYS returns 204 and never throws to the caller: tracking must never break the product.
 * Inserts run under the user's own RLS insert policy (feature_events_insert_own).
 */

const FEATURES: ReadonlySet<FeatureName> = new Set<FeatureName>([
  'aio_audit', 'ai_visibility_query', 'ai_visibility_suggest', 'category_ownership_view',
  'surface_distribution', 'surface_verify', 'intelligence_briefing_view', 'intelligence_briefing_email',
  'competitor_scan', 'competitor_scan_run', 'review_campaign_create', 'review_request_send',
  'comparison_content_generate', 'founder_audit', 'referral_program_generate', 'community_response_draft',
  'campaign_launch', 'campaign_simulate', 'report_view', 'platform_browse', 'surface_browse',
  'analytics_view', 'settings_view', 'pricing_view', 'cancel_flow_start',
])
const EVENT_TYPES: ReadonlySet<FeatureEventType> = new Set<FeatureEventType>([
  'view', 'click', 'generate', 'submit', 'export', 'email',
])

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return new NextResponse(null, { status: 204 }) // fail-soft: never signal failure

    const body = (await request.json().catch(() => null)) as Partial<FeatureEventInput> | null
    const feature = body?.feature
    const type = body?.type
    // Silently drop invalid events; a bad enum value must never surface an error to the UI.
    if (!feature || !type || !FEATURES.has(feature) || !EVENT_TYPES.has(type)) {
      return new NextResponse(null, { status: 204 })
    }

    const metadata =
      body?.metadata && typeof body.metadata === 'object' && !Array.isArray(body.metadata)
        ? body.metadata
        : {}
    const productId = typeof body?.productId === 'string' ? body.productId : null

    await supabase.from('feature_events').insert({
      user_id: user.id,
      product_id: productId,
      feature_name: feature,
      event_type: type,
      metadata,
    })
  } catch {
    // Swallow everything — telemetry is best-effort.
  }
  return new NextResponse(null, { status: 204 })
}
