'use client'

import { useEffect, useRef } from 'react'
import { trackFeature } from '@/lib/tracking'
import type { FeatureName, FeatureEventType } from '@usersessions/shared'

/**
 * Drop-in mount tracker for server-component pages. Renders nothing.
 * Fires exactly one fire-and-forget event on mount (guarded against StrictMode double-invoke).
 *
 *   <TrackView feature="analytics_view" />
 */
export function TrackView({
  feature,
  type = 'view',
  productId,
}: {
  feature: FeatureName
  type?: FeatureEventType
  productId?: string | null
}) {
  const fired = useRef(false)
  useEffect(() => {
    if (fired.current) return
    fired.current = true
    trackFeature(feature, type, { productId: productId ?? null })
  }, [feature, type, productId])
  return null
}
