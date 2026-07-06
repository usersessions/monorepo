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
 *
 * RACE-PROOF HANDSHAKE: the extension's token-bridge content script injects at
 * document_idle, often AFTER first render. A one-shot postMessage is therefore lost.
 * This component (a) retries every 2s for up to 60s, (b) re-sends when the bridge
 * announces BRIDGE_READY, and (c) stops as soon as the bridge acks TOKEN_RECEIVED.
 * The chrome.runtime.sendMessage(extensionId) path remains as a secondary fallback.
 */
export function ExtensionBridge() {
  useEffect(() => {
    const supabase = createClient()
    const extensionId = process.env.NEXT_PUBLIC_EXTENSION_ID

    let latestToken: string | undefined
    let acked = false

    const post = () => {
      if (!latestToken || acked) return
      try {
        window.postMessage(
          { source: 'usersessions-dashboard', type: 'SET_TOKEN', token: latestToken },
          window.location.origin
        )
      } catch {
        // Never a user-facing error.
      }
      if (extensionId && typeof chrome !== 'undefined' && chrome?.runtime?.sendMessage) {
        try {
          chrome.runtime.sendMessage(extensionId, { type: 'SET_TOKEN', token: latestToken })
        } catch {
          // Extension not installed or not listening — never a user-facing error.
        }
      }
    }

    const send = (token: string | undefined) => {
      if (!token) return
      if (token !== latestToken) {
        latestToken = token
        acked = false // a refreshed token must be delivered again
      }
      post()
    }

    const interval = setInterval(post, 2_000)
    const stopRetries = setTimeout(() => clearInterval(interval), 60_000)

    const onMessage = (event: MessageEvent) => {
      if (event.source !== window || event.origin !== window.location.origin) return
      const data = event.data as { source?: string; type?: string } | undefined
      if (data?.source !== 'usersessions-extension') return
      if (data.type === 'BRIDGE_READY') post()
      if (data.type === 'TOKEN_RECEIVED') acked = true
    }
    window.addEventListener('message', onMessage)

    supabase.auth.getSession().then(({ data }) => send(data.session?.access_token))
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) =>
      send(session?.access_token)
    )

    return () => {
      sub.subscription.unsubscribe()
      window.removeEventListener('message', onMessage)
      clearInterval(interval)
      clearTimeout(stopRetries)
    }
  }, [])

  return null
}
