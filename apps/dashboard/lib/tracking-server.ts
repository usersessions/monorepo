import { createServiceClient } from '@/lib/supabase/server'
import type { FeatureName, FeatureEventType } from '@usersessions/shared'

/**
 * SERVER ONLY. Direct service-role insert; use at the start of API routes, server actions,
 * and crons. Deliberately kept out of lib/tracking.ts (client-safe): this file imports
 * lib/supabase/server, which pulls in next/headers and cannot be bundled for the client.
 */
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
