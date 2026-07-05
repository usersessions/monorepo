'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { limitsFor } from '@/lib/tiers'

export async function addVisibilityQuery(formData: FormData) {
  const productId = String(formData.get('productId') ?? '')
  const query = String(formData.get('query') ?? '').trim().slice(0, 200)
  if (!productId || !query) return

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return

  // Plan limit on tracked queries per product (BUILD_SPEC §11)
  const { data: profile } = await supabase.from('profiles').select('plan').eq('id', user.id).single()
  const { count } = await supabase
    .from('visibility_queries')
    .select('*', { count: 'exact', head: true })
    .eq('product_id', productId)
  if ((count ?? 0) >= limitsFor(profile?.plan).visibilityQueriesPerProduct) return

  await supabase.from('visibility_queries').insert({ user_id: user.id, product_id: productId, query })
  revalidatePath('/analytics')
}

export async function deleteVisibilityQuery(formData: FormData) {
  const queryId = String(formData.get('queryId') ?? '')
  if (!queryId) return
  const supabase = await createClient() // RLS scopes the delete to the owner
  await supabase.from('visibility_queries').delete().eq('id', queryId)
  revalidatePath('/analytics')
}
