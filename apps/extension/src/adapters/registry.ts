import type { PlatformAdapter } from './types'

/**
 * PILOT ADAPTERS (EXECUTION_PLAN M6: 3 pilots before the other 12).
 * verified is FALSE on every adapter — deliberately. These selectors are generic
 * guesses that were never checked against the live, login-gated forms, and field
 * reports confirm live runs opened tabs without filling anything. The background
 * M6 gate therefore forces simulation mode until each adapter is rebuilt against
 * the platform's real DOM and one live submission is verified end-to-end.
 * verified flips to true by PROOF of a working live run, never by decision.
 */
export const ADAPTERS: PlatformAdapter[] = [
  {
    platformId: 'theresanaiforthat',
    category: 'ai',
    submitUrl: 'https://theresanaiforthat.com/submit/',
    verified: false,
    steps: [
      { op: 'waitFor', selector: 'form' },
      { op: 'fill', selector: 'input[name="name"], input[name="title"]', value: 'title' },
      { op: 'fill', selector: 'input[name="url"], input[type="url"]', value: 'url' },
      { op: 'fill', selector: 'textarea[name="description"], textarea', value: 'body' },
      { op: 'submit', selector: 'button[type="submit"], input[type="submit"]' },
    ],
  },
  {
    platformId: 'futurepedia',
    category: 'ai',
    submitUrl: 'https://www.futurepedia.io/submit-tool',
    verified: false,
    steps: [
      { op: 'waitFor', selector: 'form' },
      { op: 'fill', selector: 'input[name="toolName"], input[name="name"]', value: 'title' },
      { op: 'fill', selector: 'input[name="toolUrl"], input[type="url"]', value: 'url' },
      { op: 'fill', selector: 'textarea[name="description"], textarea', value: 'body' },
      { op: 'submit', selector: 'button[type="submit"]' },
    ],
  },
  {
    platformId: 'uneed',
    category: 'startup',
    submitUrl: 'https://www.uneed.best/submit-a-tool',
    verified: false,
    steps: [
      { op: 'waitFor', selector: 'form' },
      { op: 'fill', selector: 'input[name="name"]', value: 'title' },
      { op: 'fill', selector: 'input[name="url"], input[type="url"]', value: 'url' },
      { op: 'fill', selector: 'input[name="tagline"]', value: 'hook' },
      { op: 'fill', selector: 'textarea[name="description"], textarea', value: 'body' },
      { op: 'submit', selector: 'button[type="submit"]' },
    ],
  },
]

export function getAdapter(platformId: string): PlatformAdapter | undefined {
  return ADAPTERS.find((a) => a.platformId === platformId)
}
