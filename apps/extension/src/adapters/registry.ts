import type { PlatformAdapter } from './types'

/**
 * PILOT ADAPTERS (EXECUTION_PLAN M6: 3 pilots before the other 12).
 * LIVE-ENABLED by owner decision: these run against each platform's public submit
 * form in the founder's own browser session. The runner reports per-platform
 * failures honestly, so selector drift surfaces as a 'failed' result in the popup
 * and on the dashboard — never as a silent bad submission. Re-verify selectors
 * against the live DOM after any platform redesign.
 */
export const ADAPTERS: PlatformAdapter[] = [
  {
    platformId: 'theresanaiforthat',
    category: 'ai',
    submitUrl: 'https://theresanaiforthat.com/submit/',
    verified: true,
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
    verified: true,
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
    verified: true,
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
