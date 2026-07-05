'use server'

import { revalidatePath } from 'next/cache'
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
}
