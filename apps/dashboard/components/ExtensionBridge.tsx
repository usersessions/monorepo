'use client'

import { useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { BridgeMessage } from '@usersessions/shared'

declare const chrome:
  | { runtime?: { sendMessage?: (id: string, msg: BridgeMessage) => void } }
  | undefined

/**
 * Renders nothing. Delivers the Supabase access token to the extension on mount AND on
 * every auth state change — including TOKEN_REFRESHED (BUILD_SPEC §7).
 * TWO delivery paths so the connection never depends on build configuration:
 * 1. window.postMessage → picked up by the extension's token-bridge content script.
 *    Works for ANY install (packed, unpacked, dev) — no extension ID required.
 * 2. chrome.runtime.sendMessage(NEXT_PUBLIC_EXTENSION_ID) — kept as a fallback for the
 *    brief window before the content script injects.
 */
export function ExtensionBridge() {
  useEffect(() => {
    const supabase = createClient()
    const extensionId = process.env.NEXT_PUBLIC_EXTENSION_ID

    const send = (token: string | undefined) => {
      if (!token) return
      try {
        window.postMessage(
          { source: 'usersessions-dashboard', type: 'SET_TOKEN', token },
          window.location.origin
        )
      } catch {
        // Never a user-facing error.
      }
      if (extensionId && typeof chrome !== 'undefined' && chrome?.runtime?.sendMessage) {
        try {
          chrome.runtime.sendMessage(extensionId, { type: 'SET_TOKEN', token })
        } catch {
          // Extension not installed or not listening — never a user-facing error.
        }
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
