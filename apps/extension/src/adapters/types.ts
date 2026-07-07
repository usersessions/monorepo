import type { PlatformCategory } from '@usersessions/shared'

/**
 * Declarative adapters: each platform is a list of steps executed by ONE generic runner
 * (contents/adapter-runner.ts). Selector fixes are data changes, not logic changes —
 * which is exactly what the Phase 7 review queue diffs against.
 */

/** Values resolved at runtime from the product + approved copy + founder profile. */
export type FieldRef =
  | 'title'
  | 'url'
  | 'tagline'
  | 'hook'
  | 'body'
  | 'founderName'
  | 'contactEmail'
  | 'category'
  | 'tags' // resolved comma-separated for plain inputs; tag widgets need platform-specific steps
  | 'pricingModel'
  | 'socialTwitter'
  | 'socialLinkedIn'
  | 'socialGitHub'

export type AdapterStep =
  | { op: 'fill'; selector: string; value: FieldRef }
  | { op: 'click'; selector: string }
  /**
   * Choose an option in a native <select>. Provide 'value' (a FieldRef) or 'option'
   * (a literal option value/label for platform-specific vocabularies). 'option' wins.
   */
  | { op: 'select'; selector: string; value?: FieldRef; option?: string }
  /** Set a checkbox/radio to a state (default: checked). */
  | { op: 'check'; selector: string; checked?: boolean }
  /**
   * Multi-step wizard navigation: click 'selector' (e.g. a Next button), then wait
   * for 'expect' to appear so the next step is confirmed rendered before continuing.
   */
  | { op: 'next'; selector: string; expect: string; timeoutMs?: number }
  | { op: 'waitFor'; selector: string; timeoutMs?: number }
  /** The final submit — SKIPPED in simulation mode. */
  | { op: 'submit'; selector: string }

export interface PlatformAdapter {
  platformId: string
  category: PlatformCategory
  submitUrl: string
  /**
   * M6 GATE, ENFORCED IN CODE: live (non-simulated) runs are refused while false.
   * Flip to true ONLY after a real submission has been verified against the live site.
   */
  verified: boolean
  steps: AdapterStep[]
}

/**
 * Founder-provided profile, entered and approved by the human in the popup/dashboard
 * and stored in chrome.storage.local under 'founderProfile'. Adapters only ever fill
 * forms with data the founder explicitly provided — never invented credentials.
 */
export interface FounderProfile {
  founderName?: string
  contactEmail?: string
  pricingModel?: string
  socialLinks?: { twitter?: string; linkedin?: string; github?: string }
}

/** Values handed to the runner content script. */
export interface RunContext {
  title: string
  url: string // UTM already appended
  tagline: string
  hook: string
  body: string
  founderName: string
  contactEmail: string
  category: string
  tags: string[]
  pricingModel: string
  socialLinks: { twitter?: string; linkedin?: string; github?: string }
}

export type AdapterOutcome =
  | { outcome: 'filled' } // simulation success: every field located and filled, submit skipped
  | { outcome: 'submitted' }
  | { outcome: 'captcha' } // human needed — assisted automation (BUILD_SPEC §1)
  | { outcome: 'failed'; error: string }
