import type { PlasmoCSConfig } from 'plasmo'
import type { AdapterOutcome, AdapterStep, FieldRef, RunContext } from '../adapters/types'

export const config: PlasmoCSConfig = {
  matches: ['<all_urls>'],
}

/**
 * Generic adapter executor. Fills and clicks EXACTLY what the declarative steps say —
 * no page-specific logic lives here. In simulation mode the final 'submit' step is
 * skipped, so simulation can never post anything real. Supports resuming from a step
 * index after a human hand-off (CAPTCHA/OTP), per the stateful pause/resume flow.
 */

const CAPTCHA_SELECTOR =
  'iframe[src*="recaptcha"], iframe[src*="hcaptcha"], iframe[src*="turnstile"], .g-recaptcha, .h-captcha, .cf-turnstile'

function resolveValue(ref: string, ctx: RunContext): string {
  switch (ref) {
    case 'title':
      return ctx.title
    case 'url':
      return ctx.url
    case 'tagline':
      return ctx.tagline
    case 'hook':
      return ctx.hook
    case 'body':
      return ctx.body
    case 'founderName':
      return ctx.founderName
    case 'contactEmail':
      return ctx.contactEmail
    case 'category':
      return ctx.category
    case 'tags':
      return ctx.tags.join(', ')
    case 'pricingModel':
      return ctx.pricingModel
    case 'socialTwitter':
      return ctx.socialLinks.twitter ?? ''
    case 'socialLinkedIn':
      return ctx.socialLinks.linkedin ?? ''
    case 'socialGitHub':
      return ctx.socialLinks.github ?? ''
    case 'userInput':
      return ctx.userInput
    default:
      return ''
  }
}

function setNativeValue(el: HTMLInputElement | HTMLTextAreaElement, value: string): void {
  // Set through the native setter so React/Vue-controlled inputs register the change.
  const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype
  const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set
  setter ? setter.call(el, value) : (el.value = value)
  el.dispatchEvent(new Event('input', { bubbles: true }))
  el.dispatchEvent(new Event('change', { bubbles: true }))
}

function setSelectValue(el: HTMLSelectElement, wanted: string): boolean {
  const target = wanted.trim().toLowerCase()
  const match = Array.from(el.options).find(
    (o) => o.value.trim().toLowerCase() === target || o.text.trim().toLowerCase() === target
  )
  if (!match) return false
  const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')?.set
  setter ? setter.call(el, match.value) : (el.value = match.value)
  el.dispatchEvent(new Event('input', { bubbles: true }))
  el.dispatchEvent(new Event('change', { bubbles: true }))
  return true
}

function waitFor(selector: string, timeoutMs: number): Promise<Element | null> {
  return new Promise((resolve) => {
    const found = document.querySelector(selector)
    if (found) return resolve(found)
    const started = Date.now()
    const interval = setInterval(() => {
      const el = document.querySelector(selector)
      if (el || Date.now() - started > timeoutMs) {
        clearInterval(interval)
        resolve(el)
      }
    }, 250)
  })
}

// ---------- Semantic field detection (context-aware smartFill) ----------

const FIELD_HINTS: Record<string, string[]> = {
  title: ['product name', 'tool name', 'app name', 'startup name', 'title', 'name'],
  url: ['website url', 'product url', 'website', 'homepage', 'url', 'link'],
  tagline: ['tagline', 'subtitle', 'one-liner', 'one liner', 'short description'],
  hook: ['tagline', 'headline', 'hook'],
  body: ['full description', 'long description', 'description', 'about', 'tell us'],
  founderName: ['your name', 'full name', 'maker name', 'founder', 'maker', 'first name'],
  contactEmail: ['email address', 'e-mail', 'contact email', 'email'],
  category: ['category', 'type of tool', 'type'],
  tags: ['tags', 'keywords', 'topics'],
  pricingModel: ['pricing model', 'pricing', 'price'],
  socialTwitter: ['twitter', 'x profile', 'x.com'],
  socialLinkedIn: ['linkedin'],
  socialGitHub: ['github'],
  userInput: ['verification code', 'one-time', 'otp', 'code'],
}

/** Every scrap of text that semantically describes a field, lowercased and normalised. */
function semanticText(el: Element): string {
  const parts: string[] = []
  const id = el.getAttribute('id')
  if (id) {
    const label = document.querySelector(`label[for="${CSS.escape(id)}"]`)
    if (label?.textContent) parts.push(label.textContent)
  }
  const wrapping = el.closest('label')
  if (wrapping?.textContent) parts.push(wrapping.textContent)
  const labelledBy = el.getAttribute('aria-labelledby')
  if (labelledBy) {
    for (const rid of labelledBy.split(/\s+/)) parts.push(document.getElementById(rid)?.textContent ?? '')
  }
  for (const attr of ['aria-label', 'placeholder', 'name', 'id']) {
    const v = el.getAttribute(attr)
    if (v) parts.push(v)
  }
  const prev = el.previousElementSibling?.textContent
  if (prev) parts.push(prev.slice(0, 120))
  return parts.join(' ').toLowerCase().replace(/[\s_-]+/g, ' ')
}

function isFillable(el: Element): el is HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement {
  if (el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement) return true
  if (!(el instanceof HTMLInputElement)) return false
  return !['hidden', 'submit', 'button', 'file', 'checkbox', 'radio', 'image', 'reset', 'password'].includes(el.type)
}

/** Finds the visible form control that best matches the semantic purpose of 'field'. */
function findFieldFor(field: FieldRef, extraHint?: string): HTMLElement | null {
  const hints = [...(extraHint ? [extraHint.toLowerCase()] : []), ...(FIELD_HINTS[field] ?? [])]
  let best: { el: Element; score: number } | null = null
  const candidates = Array.from(document.querySelectorAll('input, textarea, select')).filter(
    (el) => isFillable(el) && (el as HTMLElement).offsetParent !== null
  )
  for (const el of candidates) {
    const text = semanticText(el)
    let score = 0
    hints.forEach((hint, idx) => {
      // Earlier (more specific) hints outrank later generic ones; longer phrases beat single words.
      if (text.includes(hint)) score = Math.max(score, 100 - idx * 5 + Math.min(hint.length, 20))
    })
    if (score === 0) continue
    if (el instanceof HTMLInputElement) {
      if (field === 'contactEmail' && el.type === 'email') score += 30
      if (field === 'url' && el.type === 'url') score += 30
      if (field === 'body') score -= 10 // long descriptions live in textareas
    }
    if (el instanceof HTMLTextAreaElement && field === 'body') score += 25
    if (score > (best?.score ?? 0)) best = { el, score }
  }
  return best ? (best.el as HTMLElement) : null
}

async function runSteps(
  steps: AdapterStep[],
  ctx: RunContext,
  simulated: boolean,
  startAt: number
): Promise<AdapterOutcome> {
  for (let i = startAt; i < steps.length; i++) {
    const step = steps[i]
    switch (step.op) {
      case 'waitFor': {
        const el = await waitFor(step.selector, step.timeoutMs ?? 10_000)
        if (!el) return { outcome: 'failed', error: `timeout waiting for ${step.selector}` }
        break
      }
      case 'fill': {
        const el = document.querySelector<HTMLInputElement | HTMLTextAreaElement>(step.selector)
        if (!el) return { outcome: 'failed', error: `missing field ${step.selector}` }
        setNativeValue(el, resolveValue(step.value, ctx))
        break
      }
      case 'smartFill': {
        const value = resolveValue(step.field, ctx)
        if (!value) break // nothing approved for this field — skip, never invent data
        const el = findFieldFor(step.field, step.hint)
        if (!el) return { outcome: 'failed', error: `could not locate a '${step.field}' field on this form` }
        if (el instanceof HTMLSelectElement) {
          if (!setSelectValue(el, value)) {
            return { outcome: 'failed', error: `no option matching '${value}' in detected ${step.field} select` }
          }
        } else {
          setNativeValue(el as HTMLInputElement | HTMLTextAreaElement, value)
        }
        break
      }
      case 'click': {
        const el = document.querySelector<HTMLElement>(step.selector)
        if (!el) return { outcome: 'failed', error: `missing element ${step.selector}` }
        el.click()
        break
      }
      case 'select': {
        const el = document.querySelector<HTMLSelectElement>(step.selector)
        if (!el) return { outcome: 'failed', error: `missing select ${step.selector}` }
        const wanted = step.option ?? resolveValue(step.value ?? '', ctx)
        if (!setSelectValue(el, wanted)) {
          return { outcome: 'failed', error: `no option '${wanted}' in ${step.selector}` }
        }
        break
      }
      case 'check': {
        const el = document.querySelector<HTMLInputElement>(step.selector)
        if (!el) return { outcome: 'failed', error: `missing checkbox ${step.selector}` }
        const want = step.checked ?? true
        if (el.checked !== want) el.click()
        break
      }
      case 'next': {
        // Wizard navigation: advance, then PROVE the next step rendered before continuing.
        const btn = document.querySelector<HTMLElement>(step.selector)
        if (!btn) return { outcome: 'failed', error: `missing wizard control ${step.selector}` }
        btn.click()
        const el = await waitFor(step.expect, step.timeoutMs ?? 10_000)
        if (!el) return { outcome: 'failed', error: `wizard step did not render: ${step.expect}` }
        break
      }
      case 'awaitUser': {
        // Explicit human hand-off; resume continues at the step AFTER this one.
        return { outcome: 'needs_human', reason: step.reason, message: step.message, nextStep: i + 1 }
      }
      case 'submit': {
        // Human-in-the-loop: never fight a CAPTCHA — pause and resume at this same step.
        if (document.querySelector(CAPTCHA_SELECTOR)) {
          return {
            outcome: 'needs_human',
            reason: 'captcha',
            message: 'Solve the CAPTCHA on this page, then continue.',
            nextStep: i,
          }
        }
        if (simulated) return { outcome: 'filled' } // simulation stops HERE, always
        const el = document.querySelector<HTMLElement>(step.selector)
        if (!el) return { outcome: 'failed', error: `missing submit ${step.selector}` }
        el.click()
        return { outcome: 'submitted' }
      }
    }
  }
  return simulated ? { outcome: 'filled' } : { outcome: 'submitted' }
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type === 'RUN_ADAPTER') {
    void runSteps(
      msg.steps as AdapterStep[],
      msg.context as RunContext,
      Boolean(msg.simulated),
      typeof msg.resumeFrom === 'number' ? msg.resumeFrom : 0
    ).then(sendResponse)
    return true // async
  }
})
