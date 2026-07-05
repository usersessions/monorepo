'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

/** Updates the signed-in user's own profile row (RLS-scoped — role/plan untouchable here). */
export async function updateProfile(formData: FormData) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return

  const fullName = String(formData.get('full_name') ?? '')
    .trim()
    .slice(0, 120)

  await supabase
    .from('profiles')
    .update({ full_name: fullName || null })
    .eq('id', user.id)

  revalidatePath('/settings')
  revalidatePath('/', 'layout') // sidebar avatar/name
  redirect('/settings?saved=1')
}

/** Saves notification preferences to profiles. */
export async function saveNotificationPrefs(formData: FormData) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return

  await supabase
    .from('profiles')
    .update({
      notif_weekly_digest: formData.get('notif_weekly_digest') === 'on',
      notif_link_alerts: formData.get('notif_link_alerts') === 'on',
      notif_new_platforms: formData.get('notif_new_platforms') === 'on',
    })
    .eq('id', user.id)

  revalidatePath('/settings')
  redirect('/settings?notif_saved=1')
}
