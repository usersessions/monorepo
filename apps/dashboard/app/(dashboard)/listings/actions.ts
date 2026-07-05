'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

/**
 * Dead-link resubmission: the dashboard can never invoke browser automation itself
 * (BUILD_SPEC §8) — it queues; the extension picks the queue up. RLS scopes the insert.
 */
export async function queueResubmission(formData: FormData) {
  const submissionId = String(formData.get('submissionId') ?? '')
  const platformId = String(formData.get('platformId') ?? '')
  if (!submissionId || !platformId) return

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return

  await supabase.from('resubmission_queue').insert({
    user_id: user.id,
    original_submission_id: submissionId,
    platform_id: platformId,
  })
  revalidatePath('/listings')
}
