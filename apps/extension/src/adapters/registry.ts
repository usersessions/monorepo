import type { PlatformAdapter } from './types'

/**
 * PILOT ADAPTERS (EXECUTION_PLAN M6: 3 pilots before the other 12).
 * verified is FALSE on every adapter — deliberately. Steps now use the semantic
 * smartFill engine instead of guessed name-attribute selectors, but NOTHING here
 * has been verified against the live, login-gated forms yet. The background M6
 * gate forces simulation mode until each adapter passes one real, watched live
 * submission. verified flips to true by PROOF, never by decision.
 */
export const ADAPTERS: PlatformAdapter[] = [
  {
    platformId: 'theresanaiforthat',
    category: 'ai',
    submitUrl: 'https://theresanaiforthat.com/submit/',
    verified: false,
    requirements: { requiresAccount: true },
    steps: [
      { op: 'waitFor', selector: 'form' },
      { op: 'smartFill', field: 'title' },
      { op: 'smartFill', field: 'url' },
      { op: 'smartFill', field: 'body' },
      { op: 'submit', selector: 'button[type="submit"], input[type="submit"]' },
    ],
  },
  {
    platformId: 'futurepedia',
    category: 'ai',
    submitUrl: 'https://www.futurepedia.io/submit-tool',
    verified: false,
    requirements: { requiresAccount: true },
    steps: [
      { op: 'waitFor', selector: 'form' },
      { op: 'smartFill', field: 'title' },
      { op: 'smartFill', field: 'url' },
      { op: 'smartFill', field: 'body' },
      { op: 'submit', selector: 'button[type="submit"]' },
    ],
  },
  {
    platformId: 'uneed',
    category: 'startup',
    submitUrl: 'https://www.uneed.best/submit-a-tool',
    verified: false,
    requirements: { requiresAccount: true },
    steps: [
      { op: 'waitFor', selector: 'form' },
      { op: 'smartFill', field: 'title' },
      { op: 'smartFill', field: 'url' },
      { op: 'smartFill', field: 'tagline' },
      { op: 'smartFill', field: 'body' },
      { op: 'submit', selector: 'button[type="submit"]' },
    ],
  },
]

export function getAdapter(platformId: string): PlatformAdapter | undefined {
  return ADAPTERS.find((a) => a.platformId === platformId)
}
