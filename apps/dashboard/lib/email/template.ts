/**
 * usersessions Email Design System v1.0 (July 2026) — dark, precise, premium.
 * Every email is a brand touchpoint: it must feel like the dashboard.
 * Email-safe by construction: inline styles only, presentation tables, 600px
 * column, dark-first color-scheme meta, !important colors to defeat client
 * dark-mode inversion. Custom fonts fall back to email-safe stacks.
 */

const T = {
  ink: '#09090F',
  ink2: '#0F0F1A',
  paper: '#F4F2ED',
  muted: '#A8A5A0',
  muted2: '#6B6862',
  border: '#232330',
  primary: '#6366F1',
  cyan: '#22D3EE',
  green: '#34D399',
  amber: '#FBBF24',
  red: '#F87171',
} as const

const SANS = "Syne,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif"
const MONO = "'DM Mono','SF Mono',Monaco,'Cascadia Code','Roboto Mono',Consolas,'Courier New',monospace"
const SERIF = "'Instrument Serif',Georgia,'Times New Roman',serif"

const site = () => process.env.NEXT_PUBLIC_SITE_URL ?? 'https://usersessions.io'

export function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

const BADGE: Record<'live' | 'pending' | 'dead' | 'running', { c: string; bg: string; bd: string }> = {
  live: { c: T.green, bg: 'rgba(52,211,153,0.15)', bd: 'rgba(52,211,153,0.3)' },
  pending: { c: T.amber, bg: 'rgba(251,191,36,0.15)', bd: 'rgba(251,191,36,0.3)' },
  dead: { c: T.red, bg: 'rgba(248,113,113,0.15)', bd: 'rgba(248,113,113,0.3)' },
  running: { c: T.cyan, bg: 'rgba(34,211,238,0.15)', bd: 'rgba(34,211,238,0.3)' },
}

/** Pill status badge — DM Mono 11px uppercase on a 15% tint. */
export function statusBadge(kind: 'live' | 'pending' | 'dead' | 'running', label: string): string {
  const b = BADGE[kind]
  return `<span style="display:inline-block;border-radius:4px;padding:4px 10px;font-family:${MONO};font-size:11px;text-transform:uppercase;letter-spacing:0.05em;background-color:${b.bg} !important;color:${b.c} !important;border:1px solid ${b.bd};">${escapeHtml(label)}</span>`
}

/** CTA button — solid primary (no hover in email) or secondary outline. */
export function ctaButton(label: string, href: string, variant: 'primary' | 'secondary' = 'primary'): string {
  const base = `display:inline-block;min-width:200px;text-align:center;padding:14px 28px;border-radius:4px;font-family:${SANS};font-size:14px;font-weight:600;text-decoration:none;`
  const style =
    variant === 'primary'
      ? `${base}background-color:${T.primary} !important;color:${T.paper} !important;`
      : `${base}background-color:transparent !important;color:${T.primary} !important;border:1px solid ${T.primary};`
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 0 0;"><a href="${href}" style="${style}">${escapeHtml(label)}</a></td></tr></table>`
}

/**
 * 2-column data table (label | value). Labels are escaped; values are inserted
 * as-is so callers can embed statusBadge() — callers MUST escape plain values.
 */
export function dataTable(rows: Array<[string, string]>, header?: [string, string]): string {
  const head = header
    ? `<tr>${header
        .map(
          (h) =>
            `<th align="left" style="background-color:${T.border} !important;color:${T.muted} !important;font-family:${MONO};font-size:11px;text-transform:uppercase;letter-spacing:0.05em;padding:12px 16px;">${escapeHtml(h)}</th>`
        )
        .join('')}</tr>`
    : ''
  const body = rows
    .map(
      ([label, value]) =>
        `<tr><td style="border-top:1px solid ${T.border};color:${T.muted} !important;font-family:${MONO};font-size:13px;padding:12px 16px;">${escapeHtml(label)}</td><td style="border-top:1px solid ${T.border};color:${T.paper} !important;font-family:${MONO};font-size:13px;padding:12px 16px;">${value}</td></tr>`
    )
    .join('')
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid ${T.border};border-radius:4px;border-collapse:separate;margin:16px 0 0;">${head}${body}</table>`
}

/** Inline metric card — mono label, serif value, optional delta. */
export function metricCard(label: string, value: string, delta?: { text: string; positive: boolean }): string {
  const d = delta
    ? `<div style="font-family:${MONO};font-size:12px;color:${delta.positive ? T.green : T.red} !important;padding-top:4px;">${escapeHtml(delta.text)}</div>`
    : ''
  return `<div style="background-color:${T.ink} !important;border:1px solid ${T.border};border-radius:4px;padding:16px;margin:0 0 8px;"><div style="font-family:${MONO};font-size:11px;text-transform:uppercase;letter-spacing:0.05em;color:${T.muted} !important;">${escapeHtml(label)}</div><div style="font-family:${SERIF};font-size:24px;color:${T.paper} !important;padding-top:4px;">${escapeHtml(value)}</div>${d}</div>`
}

/** 2-up grid of pre-built metricCard() HTML blocks (matches the digest/report layout). */
export function metricGrid(cards: string[]): string {
  const rows: string[] = []
  for (let i = 0; i < cards.length; i += 2) {
    rows.push(
      `<tr><td width="48%" style="vertical-align:top;padding-right:4%;">${cards[i]}</td><td width="48%" style="vertical-align:top;">${cards[i + 1] ?? ''}</td></tr>`
    )
  }
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows.join('')}</table>`
}

/** Full email document: wordmark header → hero → body slot → CTA → footer. */
export function renderEmail(input: {
  title: string
  heroTitle: string
  heroSubtitle?: string
  /** Pre-built HTML from the helpers above (or escaped text). */
  bodyHtml: string
  cta?: { label: string; href: string }
  footerNote?: string
}): string {
  const SITE = site()
  const address = process.env.EMAIL_POSTAL_ADDRESS // CAN-SPAM physical address, when configured
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="dark">
<meta name="supported-color-schemes" content="dark">
<title>${escapeHtml(input.title)}</title>
<style>
  @media (prefers-color-scheme: dark) {
    .email-body { background-color: #09090F !important; }
    .email-card { background-color: #0F0F1A !important; }
    .email-text { color: #F4F2ED !important; }
    .email-muted { color: #A8A5A0 !important; }
    .email-border { border-color: #232330 !important; }
  }
  @media only screen and (max-width: 620px) {
    .email-card-inner { padding: 24px 16px !important; }
  }
</style>
</head>
<body class="email-body" style="margin:0;padding:0;background-color:${T.ink} !important;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${T.ink} !important;">
<tr><td align="center" style="padding:40px 12px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;">
<tr><td align="center" style="padding-bottom:24px;">
  <a href="${SITE}" style="font-family:${SERIF};font-style:italic;font-size:26px;color:${T.paper} !important;text-decoration:none;">usersessions</a>
</td></tr>
<tr><td class="email-card email-card-inner" style="background-color:${T.ink2} !important;border-radius:8px;padding:40px 32px;">
  <h1 class="email-text" style="margin:0;font-family:${SANS};font-size:24px;line-height:1.3;font-weight:600;color:${T.paper} !important;">${escapeHtml(input.heroTitle)}</h1>
  ${input.heroSubtitle ? `<p class="email-muted" style="margin:8px 0 0;font-family:${SANS};font-size:16px;line-height:1.5;color:${T.muted} !important;">${escapeHtml(input.heroSubtitle)}</p>` : ''}
  <div class="email-border" style="border-bottom:1px solid ${T.border};margin-top:24px;"></div>
  <div class="email-text" style="padding-top:24px;font-family:${SANS};font-size:14px;line-height:1.6;color:${T.paper} !important;">${input.bodyHtml}</div>
  ${input.cta ? ctaButton(input.cta.label, input.cta.href) : ''}
</td></tr>
<tr><td align="center" style="padding:24px;font-family:${SANS};font-size:12px;line-height:1.6;color:${T.muted2} !important;">
  Get your product found — <a href="${SITE}" style="color:${T.muted} !important;">usersessions.io</a><br>
  ${input.footerNote ? `${escapeHtml(input.footerNote)}<br>` : ''}
  <a href="${SITE}/settings" style="color:${T.muted2} !important;text-decoration:underline;">Manage email preferences</a>${address ? `<br>${escapeHtml(address)}` : ''}
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`
}
