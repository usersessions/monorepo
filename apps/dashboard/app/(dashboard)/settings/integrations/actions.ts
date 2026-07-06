'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

const VALID_PREFIXES: Record<string, string[]> = {
  slack: ['https://hooks.slack.com/'],
  discord: ['https://discord.com/api/webhooks/', 'https://discordapp.com/api/webhooks/'],
}

export async function saveWebhook(formData: FormData) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return

  const kind = String(formData.get('kind') ?? '')
  const url = String(formData.get('webhook_url') ?? '').trim().slice(0, 500)
  const prefixes = VALID_PREFIXES[kind]
  if (!prefixes || !prefixes.some((p) => url.startsWith(p))) {
    redirect('/settings/integrations?error=invalid_url')
  }

  await supabase
    .from('integrations')
    .upsert({ user_id: user.id, kind, webhook_url: url }, { onConflict: 'user_id,kind' })

  revalidatePath('/settings/integrations')
  redirect('/settings/integrations?saved=1')
}

export async function removeWebhook(formData: FormData) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return

  const kind = String(formData.get('kind') ?? '')
  await supabase.from('integrations').delete().eq('user_id', user.id).eq('kind', kind)

  revalidatePath('/settings/integrations')
  redirect('/settings/integrations?removed=1')
}

export async function sendTestNotification(formData: FormData) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return

  const kind = String(formData.get('kind') ?? '')
  const { data: row } = await supabase
    .from('integrations')
    .select('kind, webhook_url')
    .eq('kind', kind)
    .maybeSingle()
  if (!row) redirect('/settings/integrations?test=fail')

  const payload =
    row!.kind === 'slack'
      ? { text: '*usersessions test* — your Slack alerts are wired up.' }
      : { content: '**usersessions test** — your Discord alerts are wired up.' }

  let ok = false
  try {
    const res = await fetch(row!.webhook_url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(5000),
    })
    ok = res.ok
  } catch {
    ok = false
  }

  redirect(`/settings/integrations?test=${ok ? 'ok' : 'fail'}`)
}
