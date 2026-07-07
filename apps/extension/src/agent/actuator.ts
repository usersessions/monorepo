import type { AgentAction } from '@usersessions/shared'

/**
 * ACT phase — executes exactly one planner action on the page.
 * In simulation mode the terminal 'submit' is SKIPPED (reported as success),
 * mirroring the adapter engine: simulation can never post anything real.
 */

const CAPTCHA_SELECTOR =
  'iframe[src*="recaptcha"], iframe[src*="hcaptcha"], iframe[src*="turnstile"], .g-recaptcha, .h-captcha, .cf-turnstile'

export async function executeAction(action: AgentAction, simulated: boolean): Promise<boolean> {
  switch (action.type) {
    case 'click':
      return clickElement(action.selector)
    case 'type':
      return typeIntoElement(action.selector, action.value, action.clearFirst ?? true)
    case 'select':
      return selectOption(action.selector, action.value)
    case 'upload':
      return uploadFile(action.selector, action.fileUrl)
    case 'scroll':
      return performScroll(action)
    case 'wait':
      await sleep(Math.min(action.durationMs, 10_000))
      return true
    case 'navigate':
      window.location.assign(action.url) // domain lock enforced by the orchestrator BEFORE dispatch
      return true
    case 'submit': {
      if (document.querySelector(CAPTCHA_SELECTOR)) return false // orchestrator pauses on next perceive
      if (simulated) return true // fail-closed: simulation never submits
      return submitForm(action.selector)
    }
    case 'pause':
    case 'complete':
      return true // terminal decisions are handled by the orchestrator
    default:
      return false
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

function query<T extends Element>(selector: string): T | null {
  try {
    return document.querySelector<T>(selector)
  } catch {
    return null // invalid selector from the planner must never throw
  }
}

function setNativeValue(el: HTMLInputElement | HTMLTextAreaElement, value: string): void {
  // Through the native setter so React/Vue-controlled inputs register the change.
  const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype
  const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set
  setter ? setter.call(el, value) : (el.value = value)
  el.dispatchEvent(new Event('input', { bubbles: true }))
  el.dispatchEvent(new Event('change', { bubbles: true }))
}

async function clickElement(selector: string): Promise<boolean> {
  const el = query<HTMLElement>(selector)
  if (!el) return false
  el.scrollIntoView({ behavior: 'smooth', block: 'center' })
  await sleep(300)
  el.click()
  return true
}

async function typeIntoElement(selector: string, value: string, clearFirst: boolean): Promise<boolean> {
  const el = query<HTMLInputElement | HTMLTextAreaElement>(selector)
  if (!el) return false
  el.scrollIntoView({ behavior: 'smooth', block: 'center' })
  await sleep(300)
  el.focus()
  if (clearFirst) setNativeValue(el, '')
  // Human-like pacing, but through the native setter on every keystroke.
  let current = clearFirst ? '' : el.value
  for (const char of value) {
    current += char
    setNativeValue(el, current)
    await sleep(10 + Math.random() * 40)
  }
  el.dispatchEvent(new Event('blur', { bubbles: true }))
  return true
}

async function selectOption(selector: string, value: string): Promise<boolean> {
  const el = query<HTMLSelectElement>(selector)
  if (!el) return false
  const wanted = value.trim().toLowerCase()
  const option = Array.from(el.options).find(
    (o) => o.value === value || o.text === value || o.text.trim().toLowerCase().includes(wanted)
  )
  if (!option) return false
  const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')?.set
  setter ? setter.call(el, option.value) : (el.value = option.value)
  el.dispatchEvent(new Event('input', { bubbles: true }))
  el.dispatchEvent(new Event('change', { bubbles: true }))
  return true
}

async function uploadFile(selector: string, fileUrl: string): Promise<boolean> {
  const el = query<HTMLInputElement>(selector)
  if (!el || el.type !== 'file') return false
  // Only data: URLs (assets the extension captured itself) — never remote fetches.
  if (!fileUrl.startsWith('data:')) return false
  try {
    const blob = await (await fetch(fileUrl)).blob()
    const file = new File([blob], 'productHero.png', { type: blob.type || 'image/png' })
    const dt = new DataTransfer()
    dt.items.add(file)
    el.files = dt.files
    el.dispatchEvent(new Event('change', { bubbles: true }))
    return true
  } catch {
    return false
  }
}

function performScroll(action: Extract<AgentAction, { type: 'scroll' }>): boolean {
  if (action.direction === 'toElement' && action.selector) {
    const el = query<HTMLElement>(action.selector)
    if (!el) return false
    el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    return true
  }
  window.scrollBy({ top: action.direction === 'down' ? 500 : -500, behavior: 'smooth' })
  return true
}

function submitForm(selector: string): boolean {
  const el = query<HTMLElement>(selector)
  if (!el) return false
  if (el instanceof HTMLFormElement) {
    el.requestSubmit ? el.requestSubmit() : el.submit()
  } else {
    el.click()
  }
  return true
}
