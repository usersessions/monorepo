'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

/** RLS-scoped: users can only ever mark their own notifications. */
export async function markAllRead() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return

  await supabase.from('notifications').update({ read: true }).eq('read', false)
  revalidatePath('/notifications')
  revalidatePath('/')
}

export async function markRead(formData: FormData) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return

  const id = String(formData.get('id') ?? '')
  if (!id) return
  await supabase.from('notifications').update({ read: true }).eq('id', id)
  revalidatePath('/notifications')
}
