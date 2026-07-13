import { createServiceClient } from '@/lib/supabase/server'
import type { FeatureEventInput, FeatureName, FeatureEventType } from '@usersessions/shared'

/**
 * Fire-and-forget feature-usage tracking. Every helper here returns void and swallows
 * all errors: a failed telemetry write must NEVER block a UI render or an API response.
 *
 *  - Client code: import { trackFeature } from '@/lib/tracking' and call it in effects / handlers.
 *  - Server code (API routes, crons): import { trackFeatureServer } and pass the user id.
 */

/** CLIENT ONLY. POSTs to /api/events; the response (always 204) is ignored. */
export function trackFeature(
  feature: FeatureName,
  type: FeatureEventType,
  opts?: { productId?: string | null; metadata?: Record<string, unknown> }
): void {
  try {
    const payload: FeatureEventInput = {
      feature,
      type,
      productId: opts?.productId ?? null,
      metadata: opts?.metadata,
    }
    void fetch('/api/events', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
      keepalive: true, // survive page navigations (e.g. tracking a click that routes away)
    }).catch(() => {})
  } catch {
    // never throw from a tracking call
  }
}

/** SERVER ONLY. Direct service-role insert; use at the start of API routes / crons. */
export function trackFeatureServer(
  userId: string,
  feature: FeatureName,
  type: FeatureEventType,
  opts?: { productId?: string | null; metadata?: Record<string, unknown> }
): void {
  try {
    const db = createServiceClient()
    void db
      .from('feature_events')
      .insert({
        user_id: userId,
        product_id: opts?.productId ?? null,
        feature_name: feature,
        event_type: type,
        metadata: opts?.metadata ?? {},
      })
      .then(() => {}, () => {})
  } catch {
    // best-effort only
  }
}
