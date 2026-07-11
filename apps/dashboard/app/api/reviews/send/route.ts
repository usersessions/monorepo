import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { sendEmail } from '@/lib/email/resend'
import { renderEmail } from '@/lib/email/template'

/**
 * POST /api/reviews/send — send a batch of APPROVED (possibly edited) review requests via
 * Resend, then mark them 'sent'. Ownership enforced via RLS on the read; sends fail-soft.
 */
export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })

  let body: { requests?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'INVALID_PAYLOAD' }, { status: 400 })
  }
  const edits = Array.isArray(body.requests) ? body.requests : []
  if (edits.length === 0) return NextResponse.json({ error: 'INVALID_PAYLOAD' }, { status: 400 })

  // Confirm ownership of these request rows via the RLS-scoped client.
  const ids = edits
    .map((e: any) => (typeof e?.requestId === 'string' ? e.requestId : null))
    .filter(Boolean) as string[]
  const { data: owned } = await supabase.from('review_requests').select('id').in('id', ids)
  const ownedIds = new Set((owned ?? []).map((r) => r.id))

  const db = createServiceClient()
  let sent = 0
  for (const e of edits as Array<{ requestId: string; subject?: string; body?: string }>) {
    if (!ownedIds.has(e.requestId)) continue
    const { data: row } = await db
      .from('review_requests')
      .select('recipient_email, recipient_name, subject, body')
      .eq('id', e.requestId)
      .maybeSingle()
    if (!row) continue
    const subject = (e.subject ?? row.subject ?? 'A quick favor').slice(0, 160)
    const bodyText = (e.body ?? row.body ?? '').slice(0, 1200)
    const res = await sendEmail({
      to: row.recipient_email,
      subject,
      html: renderEmail({
        title: subject,
        heroTitle: subject,
        bodyHtml: bodyText
          .split('\n')
          .filter(Boolean)
          .map((p) => `<p style="margin:0 0 12px;">${p.replace(/</g, '&lt;')}</p>`)
          .join(''),
      }),
    })
    if (res.ok) {
      sent++
      await db
        .from('review_requests')
        .update({ status: 'sent', subject, body: bodyText, sent_at: new Date().toISOString() })
        .eq('id', e.requestId)
    }
  }

  return NextResponse.json({ ok: true, sent })
}
