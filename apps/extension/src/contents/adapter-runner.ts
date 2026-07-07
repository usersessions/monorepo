import type { PlasmoCSConfig } from 'plasmo'
import type { AdapterOutcome, AdapterStep, RunContext } from '../adapters/types'

export const config: PlasmoCSConfig = {
  matches: ['<all_urls>'],
}

/**
 * Generic adapter executor. Fills and clicks EXACTLY what the declarative steps say —
 * no page-specific logic lives here. In simulation mode the final 'submit' step is
 * skipped, so simulation can never post anything real.
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

async function runSteps(
  steps: AdapterStep[],
  ctx: RunContext,
  simulated: boolean
): Promise<AdapterOutcome> {
  for (const step of steps) {
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
      case 'click': {
        const el = document.querySelector<HTMLElement>(step.selector)
        if (!el) return { outcome: 'failed', error: `missing element ${step.selector}` }
        el.click()
        break
      }
      case 'select': {
        const el = document.querySelector<HTMLSelectElement>(step.selector)
        if (!el) return { outcome: 'failed', error: `missing select ${step.selector}` }
        const wanted = (step.option ?? resolveValue(step.value ?? '', ctx)).trim().toLowerCase()
        const match = Array.from(el.options).find(
          (o) => o.value.trim().toLowerCase() === wanted || o.text.trim().toLowerCase() === wanted
        )
        if (!match) return { outcome: 'failed', error: `no option '${wanted}' in ${step.selector}` }
        const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')?.set
        setter ? setter.call(el, match.value) : (el.value = match.value)
        el.dispatchEvent(new Event('input', { bubbles: true }))
        el.dispatchEvent(new Event('change', { bubbles: true }))
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
      case 'submit': {
        // Human-in-the-loop: never fight a CAPTCHA — hand it to the person (BUILD_SPEC §1).
        if (document.querySelector(CAPTCHA_SELECTOR)) return { outcome: 'captcha' }
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
    void runSteps(msg.steps as AdapterStep[], msg.context as RunContext, Boolean(msg.simulated)).then(
      sendResponse
    )
    return true // async
  }
})
