import { createServiceClient } from '@/lib/supabase/server'
import type { User } from '@supabase/supabase-js'

/**
 * Authenticates extension requests carrying `Authorization: Bearer <supabase access token>`
 * (delivered to the extension by ExtensionBridge). Returns the user or null.
 */
export async function authenticateBearer(request: Request): Promise<User | null> {
  const header = request.headers.get('authorization')
  const token = header?.startsWith('Bearer ') ? header.slice(7) : null
  if (!token) return null

  const db = createServiceClient()
  const { data, error } = await db.auth.getUser(token)
  if (error || !data.user) return null
  return data.user
}
