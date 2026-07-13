import type { FeatureEventInput, FeatureName, FeatureEventType } from '@usersessions/shared'

/**
 * Fire-and-forget feature-usage tracking — CLIENT-SAFE ONLY.
 * This file must never import anything that pulls in next/headers (e.g. lib/supabase/server):
 * client components (TrackView, ExtensionActionButton, *Runner/*Generator components, etc.)
 * import trackFeature directly, and Next.js bundles this entire module for the client build.
 * Server-side tracking (API routes, server actions, crons) lives in lib/tracking-server.ts.
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
