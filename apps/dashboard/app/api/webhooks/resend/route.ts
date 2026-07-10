import crypto from 'crypto'
import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

/**
 * Resend event webhook (svix-signed): logs sent / delivered / opened / clicked /
 * bounced / complained into email_events, powering the deliverability targets
 * (delivery >98%, bounce <2%, complaint <0.1%). Configure the endpoint + secret
 * in the Resend dashboard; set RESEND_WEBHOOK_SECRET in the environment.
 * FAIL CLOSED: no secret configured means no events are accepted.
 */
function verifySvix(
  secret: string,
  id: string | null,
  timestamp: string | null,
  signature: string | null,
  payload: string
): boolean {
  if (!id || !timestamp || !signature) return false
  // Reject stale timestamps (5 min tolerance) to prevent replay.
  const ts = Number(timestamp)
  if (!Number.isFinite(ts) || Math.abs(Date.now() / 1000 - ts) > 300) return false
  const key = Buffer.from(secret.startsWith('whsec_') ? secret.slice(6) : secret, 'base64')
  const expected = crypto.createHmac('sha256', key).update(`${id}.${timestamp}.${payload}`).digest('base64')
  // svix sends space-separated versioned signatures: "v1,<base64> v1,<base64>"
  return signature.split(' ').some((part) => {
    const sig = part.includes(',') ? part.split(',')[1] : part
    try {
      return (
        sig.length === expected.length && crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))
      )
    } catch {
      return false
    }
  })
}

export async function POST(request: Request) {
  const secret = process.env.RESEND_WEBHOOK_SECRET
  if (!secret) return NextResponse.json({ error: 'NOT_CONFIGURED' }, { status: 503 })

  const payload = await request.text()
  const valid = verifySvix(
    secret,
    request.headers.get('svix-id'),
    request.headers.get('svix-timestamp'),
    request.headers.get('svix-signature'),
    payload
  )
  if (!valid) return NextResponse.json({ error: 'INVALID_SIGNATURE' }, { status: 401 })

  let event: { type?: string; data?: { email_id?: string; to?: string | string[]; subject?: string } }
  try {
    event = JSON.parse(payload)
  } catch {
    return NextResponse.json({ error: 'INVALID_PAYLOAD' }, { status: 400 })
  }

  try {
    const db = createServiceClient()
    await db.from('email_events').insert({
      email_id: event.data?.email_id ?? null,
      event_type: event.type ?? 'unknown',
      recipient: Array.isArray(event.data?.to) ? (event.data?.to[0] ?? null) : (event.data?.to ?? null),
      subject: event.data?.subject ?? null,
    })
  } catch (err) {
    // Log-and-acknowledge: a storage hiccup must not make Resend retry-storm us.
    console.error('[resend-webhook] insert failed:', err)
  }
  return NextResponse.json({ ok: true })
}
