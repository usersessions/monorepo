'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

/**
 * Renders nothing. Subscribes to the signed-in user's rows (BUILD_SPEC §8:
 * realtime refresh, zero polling) and re-renders server components when the
 * extension syncs a campaign — the dashboard updates the moment data lands.
 * Requires migration 0009 (tables added to the supabase_realtime publication);
 * without it the subscription is simply silent, never an error.
 */
export function RealtimeRefresh({ userId }: { userId: string }) {
  const router = useRouter()

  useEffect(() => {
    const supabase = createClient()
    let timer: ReturnType<typeof setTimeout> | null = null
    const refresh = () => {
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => router.refresh(), 400) // debounce burst inserts
    }

    const filter = `user_id=eq.${userId}`
    const channel = supabase
      .channel(`user-data-${userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'submissions', filter }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'campaigns', filter }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'distribution_scores', filter }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications', filter }, refresh)
      .subscribe()

    return () => {
      if (timer) clearTimeout(timer)
      void supabase.removeChannel(channel)
    }
  }, [router, userId])

  return null
}
