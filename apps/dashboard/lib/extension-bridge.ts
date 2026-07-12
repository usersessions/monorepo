'use client'

/**
 * Dashboard → extension bridge client (matches the extension's onMessageExternal handlers).
 * Fail-closed: if NEXT_PUBLIC_EXTENSION_ID is unset or chrome.runtime is unavailable, callers
 * get null and should render an install CTA instead of an action button.
 * One-shot messages with a 3s timeout — no polling.
 */

declare const chrome:
  | { runtime?: { sendMessage?: (id: string, msg: unknown, cb: (res: unknown) => void) => void; lastError?: unknown } }
  | undefined

const EXTENSION_ID = process.env.NEXT_PUBLIC_EXTENSION_ID

export function extensionSupported(): boolean {
  return typeof chrome !== 'undefined' && !!chrome?.runtime?.sendMessage && !!EXTENSION_ID
}

function sendExternal<T = { ok?: boolean; error?: string }>(msg: unknown, timeoutMs = 3000): Promise<T | null> {
  return new Promise((resolve) => {
    if (!extensionSupported()) return resolve(null)
    let done = false
    const timer = setTimeout(() => {
      if (!done) {
        done = true
        resolve(null) // no response → treat as not active
      }
    }, timeoutMs)
    try {
      chrome!.runtime!.sendMessage!(EXTENSION_ID!, msg, (res: unknown) => {
        if (done) return
        done = true
        clearTimeout(timer)
        // chrome.runtime.lastError fires when the extension isn't installed — treat as null.
        resolve((chrome?.runtime?.lastError ? null : (res as T)) ?? null)
      })
    } catch {
      clearTimeout(timer)
      if (!done) {
        done = true
        resolve(null)
      }
    }
  })
}

/** Lightweight install ping — the extension answers PING with {ok:true} (no auth needed). */
export async function pingExtension(): Promise<boolean> {
  const res = await sendExternal<{ ok?: boolean }>({ type: 'PING' }, 2000)
  return res !== null
}

export function triggerLaunch(simulated = false) {
  return sendExternal({ type: 'TRIGGER_LAUNCH', simulated })
}
export function triggerSurface(surfaceId: string) {
  return sendExternal({ type: 'TRIGGER_SURFACE', surfaceId })
}
export function triggerCapture() {
  return sendExternal({ type: 'TRIGGER_CAPTURE' })
}

export const CHROME_STORE_URL =
  process.env.NEXT_PUBLIC_EXTENSION_STORE_URL ?? 'https://chrome.google.com/webstore'
