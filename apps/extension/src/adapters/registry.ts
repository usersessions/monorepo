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
  {
    /**
     * DRAFT — UNVERIFIED. Flow shape comes from the Phase 2 research dossier; the
     * selectors below are PROVISIONAL and have NOT been checked against Product
     * Hunt's live DOM. The M6 gate keeps this in simulation, where every wrong
     * selector surfaces as an honest per-step failure to fix as a data change.
     * Deliberately deferred until live-DOM verification: gallery upload (2–5
     * images), 1:1 thumbnail crop, and the topics search-and-select widget.
     */
    platformId: 'producthunt',
    category: 'startup',
    submitUrl: 'https://www.producthunt.com/posts/new',
    verified: false,
    requirements: { requiresAccount: true, requiresSocialAuth: true, requiresScreenshot: true },
    steps: [
      // Auth gate: if the wizard never renders a URL field, PH bounced us to login — pause.
      {
        op: 'waitFor',
        selector: 'input[type="url"], input[name="url"]',
        timeoutMs: 12_000,
        elseAwaitUser: {
          reason: 'login',
          message: 'Log in to Product Hunt in this tab (Twitter, Google, or Apple), then continue.',
        },
      },
      { op: 'smartFill', field: 'url' }, // UTM already appended by the background
      { op: 'next', selector: 'button[type="submit"]', expect: 'input[name="name"], input[placeholder*="name" i]' },
      { op: 'smartFill', field: 'title' },
      { op: 'smartFill', field: 'tagline', maxLen: 60 }, // PH hard limit (dossier)
      { op: 'next', selector: 'button[type="submit"]', expect: 'textarea' },
      { op: 'smartFill', field: 'body' },
      { op: 'smartFill', field: 'tags', hint: 'topics' }, // topics combobox likely needs a bespoke step post-verification
      { op: 'smartFill', field: 'hook', hint: 'comment' }, // maker comment (dossier: founderStory/hook)
      { op: 'submit', selector: 'button[type="submit"]' },
    ],
  },
]

export function getAdapter(platformId: string): PlatformAdapter | undefined {
  return ADAPTERS.find((a) => a.platformId === platformId)
}
