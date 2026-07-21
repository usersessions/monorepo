import { createServiceClient } from '@/lib/supabase/server'

/** Server-only storage helpers for generated video assets. Bucket: 'videos'. TODO(pivot): create bucket + RLS. */
export async function storeVideoFromUrl(sourceUrl: string, path: string): Promise<string> {
  const res = await fetch(sourceUrl)
  if (!res.ok) throw new Error(`Download failed: ${res.status}`)
  const bytes = new Uint8Array(await res.arrayBuffer())
  const supabase = createServiceClient()
  const { error } = await supabase.storage.from('videos').upload(path, bytes, { contentType: 'video/mp4', upsert: true })
  if (error) throw error
  return supabase.storage.from('videos').getPublicUrl(path).data.publicUrl
}
