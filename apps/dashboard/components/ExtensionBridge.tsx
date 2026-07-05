'use client'

import { useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { BridgeMessage } from '@usersessions/shared'

declare const chrome:
  | { runtime?: { sendMessage?: (id: string, msg: BridgeMessage) => void } }
  | undefined

/**
 * Renders nothing. Sends the Supabase access token to the extension on mount AND on every
 * auth state change — including TOKEN_REFRESHED (BUILD_SPEC §7: re-send on refresh, not just mount).
 * Guarded so it never throws in a browser without the extension.
 */
export function ExtensionBridge() {
  useEffect(() => {
    const extensionId = process.env.NEXT_PUBLIC_EXTENSION_ID
    if (!extensionId || typeof chrome === 'undefined' || !chrome?.runtime?.sendMessage) return

    const supabase = createClient()

    const send = (token: string | undefined) => {
      if (!token) return
      try {
        chrome!.runtime!.sendMessage!(extensionId, { type: 'SET_TOKEN', token })
      } catch {
        // Extension not installed or not listening — never a user-facing error.
      }
    }

    supabase.auth.getSession().then(({ data }) => send(data.session?.access_token))
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) =>
      send(session?.access_token)
    )
    return () => sub.subscription.unsubscribe()
  }, [])

  return null
}
