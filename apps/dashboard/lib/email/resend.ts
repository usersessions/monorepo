/**
 * Resend API wrapper — all product email (weekly digest, notifications) goes through here.
 * Fail-soft: a missing key or failed send must never break a user-facing flow.
 */
const RESEND_API_URL = 'https://api.resend.com/emails'

export interface SendEmailInput {
  to: string | string[]
  subject: string
  html: string
}

export async function sendEmail({ to, subject, html }: SendEmailInput): Promise<{ ok: boolean }> {
  const key = process.env.RESEND_API_KEY
  if (!key) {
    console.warn('[email] RESEND_API_KEY not set — email skipped:', subject)
    return { ok: false }
  }

  try {
    const res = await fetch(RESEND_API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: process.env.RESEND_FROM ?? 'usersessions <notifications@usersessions.io>',
        to,
        subject,
        html,
      }),
    })
    return { ok: res.ok }
  } catch (err) {
    console.error('[email] send failed:', err)
    return { ok: false }
  }
}
