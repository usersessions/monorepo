import { createServiceClient } from './supabase/server'

/**
 * Feature flags — FAIL CLOSED (BUILD_SPEC §11): any lookup error is treated as disabled,
 * never as enabled. Gated pages return a real 404 while off, not a "coming soon".
 */
export async function isEnabled(flagName: string): Promise<boolean> {
  try {
    const db = createServiceClient()
    const { data, error } = await db
      .from('feature_flags')
      .select('enabled')
      .eq('flag_name', flagName)
      .maybeSingle()
    if (error) return false
    return Boolean(data?.enabled)
  } catch {
    return false
  }
}
