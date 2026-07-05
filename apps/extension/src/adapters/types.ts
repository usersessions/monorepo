import type { PlatformCategory } from '@usersessions/shared'

/**
 * Declarative adapters: each platform is a list of steps executed by ONE generic runner
 * (contents/adapter-runner.ts). Selector fixes are data changes, not logic changes —
 * which is exactly what the Phase 7 review queue diffs against.
 */

/** Values resolved at runtime from the product + approved copy. */
export type FieldRef = 'title' | 'url' | 'tagline' | 'hook' | 'body'

export type AdapterStep =
  | { op: 'fill'; selector: string; value: FieldRef }
  | { op: 'click'; selector: string }
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

/** Values handed to the runner content script. */
export interface RunContext {
  title: string
  url: string // UTM already appended
  tagline: string
  hook: string
  body: string
}

export type AdapterOutcome =
  | { outcome: 'filled' } // simulation success: every field located and filled, submit skipped
  | { outcome: 'submitted' }
  | { outcome: 'captcha' } // human needed — assisted automation (BUILD_SPEC §1)
  | { outcome: 'failed'; error: string }
