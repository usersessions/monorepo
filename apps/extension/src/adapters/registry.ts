import type { PlatformAdapter } from './types'

/**
 * FULL-CATALOG DRAFT SCAFFOLD — EVERY ADAPTER IS UNVERIFIED (verified: false).
 *
 * Flow shapes come from the Phase 2 research dossiers; selectors are best-guess
 * semantic conventions and submit URLs marked PROVISIONAL have not been confirmed.
 * The M6 gate (enforced in background.ts) holds the ENTIRE catalog in simulation
 * until the human operator live-QAs a platform and promotes it. Wrong selectors
 * surface as named per-step failures in simulation; fixes are data changes here.
 *
 * verified flips to true by PROOF of a watched live run, never by decision.
 * Known engine TODOs: image crop (1:1 logo, 16:9 hero), multi-checkbox tag
 * selection by fuzzy match, conditional branches (Toolify search-first).
 */
export const ADAPTERS: PlatformAdapter[] = [
  // ============ AI tool indexes ============
  {
    // DRAFT — dossier #4: single long form, heavy taxonomy; OG image usually auto-scraped.
    platformId: 'theresanaiforthat',
    category: 'ai',
    submitUrl: 'https://theresanaiforthat.com/submit/',
    verified: false,
    requirements: { requiresAccount: true },
    steps: [
      {
        op: 'waitFor',
        selector: 'form',
        timeoutMs: 12_000,
        elseAwaitUser: { reason: 'login', message: 'Log in to There\u2019s An AI For That in this tab, then continue.' },
      },
      { op: 'smartFill', field: 'title', hint: 'ai name' },
      { op: 'smartFill', field: 'url' },
      { op: 'smartFill', field: 'body', hint: 'use case' },
      { op: 'smartFill', field: 'pricingModel' },
      // TODO(operator): granular category checkboxes need a fuzzy multi-check op — report the DOM.
      { op: 'smartFill', field: 'category' },
      { op: 'upload', selector: 'input[type="file"]', asset: 'productHero' }, // fallback if OG scrape fails
      { op: 'submit', selector: 'button[type="submit"], input[type="submit"]' },
    ],
  },
  {
    // DRAFT — dossier #3: standard form + pricing dropdown + CRITICAL free-tier gate before Stripe.
    platformId: 'futurepedia',
    category: 'ai',
    submitUrl: 'https://www.futurepedia.io/submit-tool',
    verified: false,
    requirements: { requiresAccount: true },
    steps: [
      {
        op: 'waitFor',
        selector: 'form',
        timeoutMs: 12_000,
        elseAwaitUser: { reason: 'login', message: 'Log in to Futurepedia (Google or email) in this tab, then continue.' },
      },
      { op: 'smartFill', field: 'title', hint: 'tool name' },
      { op: 'smartFill', field: 'url', hint: 'website url' },
      { op: 'smartFill', field: 'tagline', hint: 'short description' },
      { op: 'smartFill', field: 'body', hint: 'detailed description' },
      { op: 'smartFill', field: 'pricingModel' },
      { op: 'smartFill', field: 'category' },
      // CRITICAL free-tier gate: never enter the $497 checkout. Selector is a GUESS — verify first.
      { op: 'click', selector: '[data-plan="free"], button[aria-label*="basic" i], button[aria-label*="free" i]' },
      { op: 'submit', selector: 'button[type="submit"]' },
    ],
  },
  {
    // DRAFT — dossier #11: minimal auth; pricing select; up to 3 tag checkboxes (fuzzy op TODO).
    platformId: 'futuretools',
    category: 'ai',
    submitUrl: 'https://www.futuretools.io/submit-a-tool', // PROVISIONAL URL
    verified: false,
    requirements: {},
    steps: [
      { op: 'waitFor', selector: 'form', timeoutMs: 12_000 },
      { op: 'smartFill', field: 'title', hint: 'tool name' },
      { op: 'smartFill', field: 'url' },
      { op: 'smartFill', field: 'body' },
      { op: 'smartFill', field: 'contactEmail' },
      { op: 'smartFill', field: 'pricingModel' },
      // TODO(operator): up to 3 tag checkboxes by fuzzy match — report the checkbox DOM.
      { op: 'smartFill', field: 'tags' },
      { op: 'submit', selector: 'button[type="submit"], input[type="submit"]' },
    ],
  },
  {
    // DRAFT — dossier #12: SEARCH-FIRST directory. Straight-line draft; the exists/not-exists
    // branch needs a conditional op once the operator reports the real flow.
    platformId: 'toolify',
    category: 'ai',
    submitUrl: 'https://www.toolify.ai/submit', // PROVISIONAL URL
    verified: false,
    requirements: { requiresAccount: true, requiresSocialAuth: true },
    steps: [
      {
        op: 'waitFor',
        selector: 'input',
        timeoutMs: 12_000,
        elseAwaitUser: { reason: 'login', message: 'Log in to Toolify with Google in this tab, then continue.' },
      },
      { op: 'smartFill', field: 'url', hint: 'search' }, // search for the tool first (dossier)
      { op: 'next', selector: 'button[type="submit"], [aria-label*="submit" i]', expect: 'form' },
      { op: 'smartFill', field: 'title', hint: 'tool name' },
      { op: 'smartFill', field: 'url' },
      { op: 'smartFill', field: 'body' },
      { op: 'submit', selector: 'button[type="submit"]' },
    ],
  },
  {
    // DRAFT — dossier #13: simple directory form.
    platformId: 'aitoolsdirectory',
    category: 'ai',
    submitUrl: 'https://aitoolsdirectory.com/submit', // PROVISIONAL URL
    verified: false,
    requirements: {},
    steps: [
      { op: 'waitFor', selector: 'form', timeoutMs: 12_000 },
      { op: 'smartFill', field: 'title', hint: 'tool name' },
      { op: 'smartFill', field: 'url' },
      { op: 'smartFill', field: 'body' },
      { op: 'smartFill', field: 'category' },
      { op: 'smartFill', field: 'contactEmail' },
      { op: 'submit', selector: 'button[type="submit"], input[type="submit"]' },
    ],
  },
  {
    // DRAFT — dossier #14: strict validation — short <100 chars (maxLen enforced), long >200 chars.
    // We DO NOT pad the body: if approved copy is under 200 chars the platform rejects it and
    // that failure is surfaced honestly — padding would be invented content.
    platformId: 'topai',
    category: 'ai',
    submitUrl: 'https://topai.tools/submit', // PROVISIONAL URL
    verified: false,
    requirements: {},
    steps: [
      { op: 'waitFor', selector: 'form', timeoutMs: 12_000 },
      { op: 'smartFill', field: 'title', hint: 'tool name' },
      { op: 'smartFill', field: 'url' },
      { op: 'smartFill', field: 'tagline', hint: 'short description', maxLen: 100 },
      { op: 'smartFill', field: 'body', hint: 'long description' },
      { op: 'next', selector: 'button[type="submit"]', expect: 'form' }, // 2-step form (dossier)
      { op: 'smartFill', field: 'contactEmail' },
      { op: 'submit', selector: 'button[type="submit"]' },
    ],
  },
  {
    // DRAFT — dossier #15: single page form; 16:9 screenshot upload (crop TODO — raw hero used).
    platformId: 'aitoolhunt',
    category: 'ai',
    submitUrl: 'https://www.aitoolhunt.com/submit-tool', // PROVISIONAL URL
    verified: false,
    requirements: { requiresAccount: true, requiresScreenshot: true },
    steps: [
      {
        op: 'waitFor',
        selector: 'form',
        timeoutMs: 12_000,
        elseAwaitUser: { reason: 'login', message: 'Log in to AI Tool Hunt (email or Google) in this tab, then continue.' },
      },
      { op: 'smartFill', field: 'title' },
      { op: 'smartFill', field: 'url' },
      { op: 'smartFill', field: 'body' },
      { op: 'smartFill', field: 'category' },
      { op: 'upload', selector: 'input[type="file"]', asset: 'productHero' },
      { op: 'submit', selector: 'button[type="submit"]' },
    ],
  },

  // ============ Startup launch platforms ============
  {
    // DRAFT — dossier #1 (unchanged from previous commit). 4-step wizard, OAuth gate,
    // 60-char tagline. Deferred pending live DOM: gallery (2–5 images), 1:1 thumbnail, topics widget.
    platformId: 'producthunt',
    category: 'startup',
    submitUrl: 'https://www.producthunt.com/posts/new',
    verified: false,
    requirements: { requiresAccount: true, requiresSocialAuth: true, requiresScreenshot: true },
    steps: [
      {
        op: 'waitFor',
        selector: 'input[type="url"], input[name="url"]',
        timeoutMs: 12_000,
        elseAwaitUser: {
          reason: 'login',
          message: 'Log in to Product Hunt in this tab (Twitter, Google, or Apple), then continue.',
        },
      },
      { op: 'smartFill', field: 'url' },
      { op: 'next', selector: 'button[type="submit"]', expect: 'input[name="name"], input[placeholder*="name" i]' },
      { op: 'smartFill', field: 'title' },
      { op: 'smartFill', field: 'tagline', maxLen: 60 },
      { op: 'next', selector: 'button[type="submit"]', expect: 'textarea' },
      { op: 'smartFill', field: 'body' },
      { op: 'smartFill', field: 'tags', hint: 'topics' },
      { op: 'upload', selector: 'input[type="file"]', asset: 'productHero' }, // gallery needs 2–5; engine sends 1 (TODO)
      { op: 'smartFill', field: 'hook', hint: 'comment' }, // maker comment
      { op: 'submit', selector: 'button[type="submit"]' },
    ],
  },
  {
    // DRAFT — dossier #2: magic-link auth handled as a LOGIN PAUSE (the human clicks the link in
    // their own inbox — the extension never reads email). ~50-char pitch; clean screenshot.
    platformId: 'betalist',
    category: 'startup',
    submitUrl: 'https://betalist.com/submit', // PROVISIONAL URL
    verified: false,
    requirements: { requiresAccount: true, requiresScreenshot: true },
    steps: [
      {
        op: 'waitFor',
        selector: 'form',
        timeoutMs: 12_000,
        elseAwaitUser: {
          reason: 'login',
          message: 'Log in to BetaList in this tab (Twitter, or request the email magic link and click it in your inbox), then continue.',
        },
      },
      { op: 'smartFill', field: 'title', hint: 'startup name' },
      { op: 'smartFill', field: 'url' },
      { op: 'smartFill', field: 'tagline', hint: 'pitch', maxLen: 50 },
      { op: 'smartFill', field: 'body' },
      // Status radio (Pre-launch vs Recently Launched) — GUESS, operator must confirm values.
      { op: 'check', selector: 'input[type="radio"][value*="launched" i]' },
      { op: 'upload', selector: 'input[type="file"]', asset: 'productHero' },
      { op: 'next', selector: 'button[type="submit"]', expect: 'form' }, // two-step form (dossier)
      { op: 'submit', selector: 'button[type="submit"]' },
    ],
  },
  {
    // DRAFT — dossier #5: product tied to founder profile; story-first culture.
    platformId: 'indiehackers',
    category: 'startup',
    submitUrl: 'https://www.indiehackers.com/products/new', // PROVISIONAL URL
    verified: false,
    requirements: { requiresAccount: true, requiresSocialAuth: true },
    steps: [
      {
        op: 'waitFor',
        selector: 'form, input',
        timeoutMs: 12_000,
        elseAwaitUser: { reason: 'login', message: 'Log in to Indie Hackers in this tab (Twitter, GitHub, or email), then continue.' },
      },
      { op: 'smartFill', field: 'title', hint: 'product name' },
      { op: 'smartFill', field: 'url', hint: 'website' },
      { op: 'smartFill', field: 'tagline', hint: 'elevator pitch' },
      // Revenue stage: default Pre-revenue per dossier — GUESS at the radio value.
      { op: 'check', selector: 'input[type="radio"][value*="pre" i]' },
      { op: 'smartFill', field: 'hook', hint: 'story' }, // founder story into first description/milestone
      { op: 'submit', selector: 'button[type="submit"]' },
    ],
  },
  {
    // DRAFT — dossier #6: multi-step wizard; logo 1:1 + hero 16:9 (crop TODO); launch-window slot.
    platformId: 'microlaunch',
    category: 'startup',
    submitUrl: 'https://microlaunch.net/submit', // PROVISIONAL URL
    verified: false,
    requirements: { requiresAccount: true, requiresSocialAuth: true, requiresScreenshot: true },
    steps: [
      {
        op: 'waitFor',
        selector: 'form, input',
        timeoutMs: 12_000,
        elseAwaitUser: { reason: 'login', message: 'Log in to MicroLaunch in this tab (GitHub or Twitter), then continue.' },
      },
      { op: 'smartFill', field: 'title' },
      { op: 'smartFill', field: 'tagline' },
      { op: 'smartFill', field: 'url' },
      { op: 'next', selector: 'button[type="submit"]', expect: 'textarea' },
      { op: 'smartFill', field: 'body' },
      { op: 'upload', selector: 'input[type="file"]', asset: 'productHero' }, // 16:9 crop TODO
      // Launch window: earliest open slot — needs the real widget DOM; GUESS placeholder.
      { op: 'click', selector: 'input[type="radio"]:not([disabled])' },
      { op: 'submit', selector: 'button[type="submit"]' },
    ],
  },
  {
    // DRAFT — dossier #7: scrape-first flow — enter URL, let Uneed scrape, then OVERWRITE with
    // approved copy. CRITICAL free-tier gate; login required at the end to save.
    platformId: 'uneed',
    category: 'startup',
    submitUrl: 'https://www.uneed.best/submit-a-tool',
    verified: false,
    requirements: { requiresAccount: true },
    steps: [
      { op: 'waitFor', selector: 'input[type="url"], input', timeoutMs: 12_000 },
      { op: 'smartFill', field: 'url' },
      { op: 'next', selector: 'button[type="submit"]', expect: 'form' }, // triggers their auto-scrape
      { op: 'smartFill', field: 'title' }, // overwrite scraped data with approved copy (dossier)
      { op: 'smartFill', field: 'tagline' },
      { op: 'smartFill', field: 'body' },
      // CRITICAL free-tier gate: never enter the paid skip-the-queue checkout. Selector is a GUESS.
      { op: 'click', selector: '[data-tier="free"], button[aria-label*="free" i], button[aria-label*="standard" i]' },
      {
        op: 'waitFor',
        selector: 'button[type="submit"]',
        timeoutMs: 12_000,
        elseAwaitUser: { reason: 'login', message: 'Log in to Uneed in this tab to save your submission, then continue.' },
      },
      { op: 'submit', selector: 'button[type="submit"]' },
    ],
  },
  {
    // DRAFT — dossier #8: 2-step form; category fuzzy-match; high-res screenshot.
    platformId: 'startupbase',
    category: 'startup',
    submitUrl: 'https://startupbase.io/submit', // PROVISIONAL URL
    verified: false,
    requirements: { requiresAccount: true, requiresScreenshot: true },
    steps: [
      {
        op: 'waitFor',
        selector: 'form',
        timeoutMs: 12_000,
        elseAwaitUser: { reason: 'login', message: 'Log in to StartupBase in this tab (Google or Twitter), then continue.' },
      },
      { op: 'smartFill', field: 'title', hint: 'startup name' },
      { op: 'smartFill', field: 'url' },
      { op: 'smartFill', field: 'tagline', hint: 'elevator pitch' },
      { op: 'smartFill', field: 'category' },
      { op: 'upload', selector: 'input[type="file"]', asset: 'productHero' },
      { op: 'next', selector: 'button[type="submit"]', expect: 'form' },
      { op: 'submit', selector: 'button[type="submit"]' },
    ],
  },
  {
    // DRAFT — dossier #9: beta-status radio; minimum 2 screenshots (engine sends 1 — known gap,
    // the platform's own validation will surface it honestly until multi-shot capture exists).
    platformId: 'betapage',
    category: 'startup',
    submitUrl: 'https://betapage.co/submit', // PROVISIONAL URL
    verified: false,
    requirements: { requiresAccount: true, requiresScreenshot: true },
    steps: [
      {
        op: 'waitFor',
        selector: 'form',
        timeoutMs: 12_000,
        elseAwaitUser: { reason: 'login', message: 'Log in to BetaPage in this tab (Google or email), then continue.' },
      },
      { op: 'smartFill', field: 'title' },
      { op: 'smartFill', field: 'url' },
      { op: 'smartFill', field: 'tagline' },
      { op: 'smartFill', field: 'body' },
      // Beta status radio (Coming Soon / Private Beta / Public Beta) — GUESS, confirm values.
      { op: 'check', selector: 'input[type="radio"][value*="public" i]' },
      { op: 'upload', selector: 'input[type="file"]', asset: 'productHero' },
      { op: 'submit', selector: 'button[type="submit"]' },
    ],
  },
  {
    // DRAFT — dossier #10: long single form; IGNORE the $49 Fast Track upsell; email-confirmed,
    // so requiresEmailVerification maps live submits to awaiting_email_verification.
    platformId: 'launchingnext',
    category: 'startup',
    submitUrl: 'https://www.launchingnext.com/submit/', // PROVISIONAL URL
    verified: false,
    requirements: { requiresEmailVerification: true },
    steps: [
      { op: 'waitFor', selector: 'form', timeoutMs: 12_000 },
      { op: 'smartFill', field: 'title' },
      { op: 'smartFill', field: 'url' },
      { op: 'smartFill', field: 'tagline' },
      { op: 'smartFill', field: 'body' },
      { op: 'smartFill', field: 'contactEmail' },
      // Free/standard tier — skip the Fast Track upsell. Selector is a GUESS.
      { op: 'check', selector: 'input[type="radio"][value*="free" i], input[type="radio"][value*="standard" i]' },
      { op: 'submit', selector: 'button[type="submit"], input[type="submit"]' },
    ],
  },
]

export function getAdapter(platformId: string): PlatformAdapter | undefined {
  return ADAPTERS.find((a) => a.platformId === platformId)
}
