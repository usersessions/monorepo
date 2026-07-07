import type {
  AgentPageType,
  ButtonSnapshot,
  FormSnapshot,
  InputSnapshot,
  InteractiveElement,
  PerceptionPayload,
} from '@usersessions/shared'

/**
 * PERCEIVE phase — pure DOM, no chrome.* APIs, no dependencies.
 * Produces the structured page snapshot the AI planner reasons over.
 */

export interface PerceptionMeta {
  sessionId: string
  stepIndex: number
  platformId: string
}

const MAX_TEXT = 8_000
const MAX_ELEMENTS = 60
const MAX_LINKS = 60

export function perceivePage(meta: PerceptionMeta): PerceptionPayload {
  const headings = Array.from(document.querySelectorAll('h1, h2, h3'))
    .map((h) => h.textContent?.trim() ?? '')
    .filter(Boolean)
    .slice(0, 20)
  const links = Array.from(document.querySelectorAll<HTMLAnchorElement>('a[href]'))
    .map((a) => ({ text: (a.textContent ?? '').trim().slice(0, 80), href: a.href }))
    .filter((l) => l.text && l.href)
    .slice(0, MAX_LINKS)

  return {
    url: window.location.href,
    title: document.title,
    pageType: detectPageType(),
    domSnapshot: {
      textContent: sanitizeText(document.body?.innerText ?? ''),
      forms: extractForms(),
      buttons: extractButtons(),
      inputs: extractInputs(),
      headings,
      links,
    },
    interactiveElements: extractInteractiveElements(),
    timestamp: Date.now(),
    sessionId: meta.sessionId,
    stepIndex: meta.stepIndex,
    platformId: meta.platformId,
  }
}

export function detectPageType(): AgentPageType {
  const url = window.location.href.toLowerCase()
  const bodyText = (document.body?.innerText ?? '').toLowerCase()

  // CAPTCHA first — a CAPTCHA on a login page is still a CAPTCHA pause.
  if (
    document.querySelector(
      'iframe[src*="recaptcha"], iframe[src*="hcaptcha"], iframe[src*="turnstile"], .g-recaptcha, .h-captcha, .cf-turnstile'
    ) ||
    bodyText.includes("i'm not a robot") ||
    bodyText.includes('verify you are human')
  ) {
    return 'captcha'
  }

  if (
    document.querySelector('input[type="password"]') ||
    url.includes('/login') ||
    url.includes('/signin') ||
    url.includes('/sign-in') ||
    url.includes('/oauth') ||
    bodyText.includes('continue with google') ||
    bodyText.includes('continue with twitter') ||
    ((bodyText.includes('sign in') || bodyText.includes('log in')) &&
      document.querySelectorAll('input, textarea, select').length <= 3)
  ) {
    return 'login_gate'
  }

  if (
    bodyText.includes('successfully submitted') ||
    bodyText.includes('thank you for submitting') ||
    bodyText.includes('thanks for submitting') ||
    bodyText.includes('your product has been listed') ||
    bodyText.includes('under review')
  ) {
    return 'success'
  }

  if (
    bodyText.includes('something went wrong') ||
    document.querySelector('[class*="alert-danger"], [role="alert"][class*="error"]')
  ) {
    return 'error'
  }

  if (document.querySelectorAll('input, textarea, select').length > 3) return 'form_page'
  return 'unknown'
}

export function generateRobustSelector(el: Element): string {
  // Priority: id > data-testid > name > nth-of-type path (spec §3).
  if (el.id) return `#${CSS.escape(el.id)}`
  const testId = el.getAttribute('data-testid')
  if (testId) return `[data-testid="${CSS.escape(testId)}"]`
  const name = el.getAttribute('name')
  if (name) return `${el.tagName.toLowerCase()}[name="${CSS.escape(name)}"]`

  let path = ''
  let current: Element | null = el
  while (current && current.tagName !== 'BODY') {
    const tag = current.tagName.toLowerCase()
    const parent: Element | null = current.parentElement
    if (!parent) break
    const siblings = Array.from(parent.children).filter((c) => c.tagName === current!.tagName)
    const index = siblings.indexOf(current) + 1
    path = (siblings.length > 1 ? `${tag}:nth-of-type(${index})` : tag) + (path ? ` > ${path}` : '')
    current = parent
  }
  return path || el.tagName.toLowerCase()
}

function findLabelText(el: Element): string | undefined {
  if (el.id) {
    const label = document.querySelector(`label[for="${CSS.escape(el.id)}"]`)
    if (label?.textContent) return label.textContent.trim().slice(0, 120)
  }
  const wrapping = el.closest('label')
  if (wrapping?.textContent) return wrapping.textContent.trim().slice(0, 120)
  const labelledBy = el.getAttribute('aria-labelledby')
  if (labelledBy) {
    const text = labelledBy
      .split(/\s+/)
      .map((id) => document.getElementById(id)?.textContent ?? '')
      .join(' ')
      .trim()
    if (text) return text.slice(0, 120)
  }
  return undefined
}

function isVisible(el: Element): boolean {
  const rect = el.getBoundingClientRect()
  if (rect.width === 0 || rect.height === 0) return false
  const style = window.getComputedStyle(el)
  return style.display !== 'none' && style.visibility !== 'hidden'
}

export function extractInteractiveElements(): InteractiveElement[] {
  const out: InteractiveElement[] = []
  const nodes = document.querySelectorAll(
    'button, a, input, select, textarea, [role="button"], [role="link"], [onclick]'
  )
  let i = 0
  for (const el of Array.from(nodes)) {
    if (out.length >= MAX_ELEMENTS) break
    if (!isVisible(el)) continue
    const rect = el.getBoundingClientRect()
    out.push({
      id: `el-${i++}`,
      tag: el.tagName.toLowerCase(),
      type: (el as HTMLInputElement).type || undefined,
      name: (el as HTMLInputElement).name || undefined,
      placeholder: (el as HTMLInputElement).placeholder || undefined,
      label: findLabelText(el),
      text: el.textContent?.trim().slice(0, 100) || undefined,
      selector: generateRobustSelector(el),
      boundingBox: {
        x: Math.round(rect.x),
        y: Math.round(rect.y),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
      },
      isVisible: true,
      ariaLabel: el.getAttribute('aria-label') ?? undefined,
    })
  }
  return out
}

function toInputSnapshot(el: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement): InputSnapshot {
  return {
    selector: generateRobustSelector(el),
    type: el instanceof HTMLSelectElement ? 'select' : el instanceof HTMLTextAreaElement ? 'textarea' : el.type,
    name: el.name || undefined,
    id: el.id || undefined,
    placeholder: 'placeholder' in el ? el.placeholder || undefined : undefined,
    label: findLabelText(el),
    required: el.required || undefined,
    options: el instanceof HTMLSelectElement ? Array.from(el.options).slice(0, 40).map((o) => o.text.trim()) : undefined,
    value: el.value ? el.value.slice(0, 120) : undefined,
  }
}

export function extractInputs(): InputSnapshot[] {
  return Array.from(
    document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>('input, textarea, select')
  )
    .filter((el) => isVisible(el) && (el as HTMLInputElement).type !== 'hidden')
    .slice(0, 40)
    .map(toInputSnapshot)
}

export function extractButtons(): ButtonSnapshot[] {
  return Array.from(document.querySelectorAll<HTMLElement>('button, input[type="submit"], [role="button"]'))
    .filter(isVisible)
    .slice(0, 20)
    .map((el) => ({
      selector: generateRobustSelector(el),
      text: (el.textContent?.trim() || (el as HTMLInputElement).value || '').slice(0, 80),
      type: (el as HTMLButtonElement).type === 'submit' ? ('submit' as const) : ('button' as const),
      isPrimary: (el as HTMLButtonElement).type === 'submit' || /primary|submit|cta/i.test(el.className),
    }))
}

export function extractForms(): FormSnapshot[] {
  return Array.from(document.querySelectorAll('form'))
    .slice(0, 5)
    .map((form, i) => {
      const fields = Array.from(
        form.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>('input, textarea, select')
      )
        .filter((el) => isVisible(el) && (el as HTMLInputElement).type !== 'hidden')
        .slice(0, 30)
        .map(toInputSnapshot)
      const submit = form.querySelector('button[type="submit"], input[type="submit"], button:not([type])')
      return {
        id: form.id || `form-${i}`,
        action: form.getAttribute('action') ?? undefined,
        method: form.getAttribute('method') ?? undefined,
        fields,
        submitButton: submit ? generateRobustSelector(submit) : undefined,
      }
    })
}

function sanitizeText(text: string): string {
  return text.replace(/\s+/g, ' ').trim().slice(0, MAX_TEXT)
}
