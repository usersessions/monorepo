import type { PlatformAdapter } from './types'

/**
 * PILOT ADAPTERS (EXECUTION_PLAN M6: 3 pilots before the other 12).
 * Selectors are FIRST DRAFTS against each platform's public submit form and MUST be
 * verified against the live DOM before `verified` is flipped — the runner refuses live
 * mode until then, so shipping this file unverified cannot cause a bad real submission.
 * A platform's catalog row stays active=false until its adapter passes both M6 gates.
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
