import { NextRequest, NextResponse } from 'next/server'
import { sendEmail } from '@/lib/email/resend'

export async function POST(req: NextRequest) {
  try {
    const { name, email, company, teamSize, message } = await req.json()

    if (!name || !email || !company || !message) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const adminEmail = process.env.ADMIN_EMAIL ?? 'hello@usersessions.io'

    await sendEmail({
      to: adminEmail,
      subject: `[Agency Inquiry] ${company} — ${name}`,
      html: `
        <h2>New Agency Sales Inquiry</h2>
        <table cellpadding="8" style="border-collapse:collapse;width:100%">
          <tr><td><strong>Name</strong></td><td>${name}</td></tr>
          <tr><td><strong>Email</strong></td><td><a href="mailto:${email}">${email}</a></td></tr>
          <tr><td><strong>Company</strong></td><td>${company}</td></tr>
          <tr><td><strong>Team size</strong></td><td>${teamSize || 'Not specified'}</td></tr>
        </table>
        <h3>Message</h3>
        <p style="white-space:pre-wrap">${message}</p>
      `,
    })

    // Send an acknowledgement to the prospect
    await sendEmail({
      to: email,
      subject: 'Thanks for reaching out — usersessions',
      html: `
        <p>Hi ${name},</p>
        <p>Thanks for your interest in our Agency plan! We've received your message and will get back to you within one business day.</p>
        <p>In the meantime, feel free to reply to this email if you have any questions.</p>
        <p>— The usersessions team</p>
      `,
    })

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    console.error('[/api/contact]', err)
    return NextResponse.json({ error: 'Failed to send message' }, { status: 500 })
  }
}
