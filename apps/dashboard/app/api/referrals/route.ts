import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { ReferralProgramCopy, ReferralProgramView, ReferralStructure } from '@usersessions/shared'

/** GET /api/referrals?productId= — the founder's generated referral programs (RLS owner-scoped). */
export async function GET(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })

  const productId = new URL(request.url).searchParams.get('productId')
  let qb = supabase
    .from('referral_programs')
    .select('id, structure_type, generated_copy, implemented_url, created_at')
    .order('created_at', { ascending: false })
    .limit(50)
  if (productId) qb = qb.eq('product_id', productId)
  const { data, error } = await qb
  if (error) return NextResponse.json({ error: 'QUERY_FAILED' }, { status: 500 })

  const programs: ReferralProgramView[] = (data ?? []).map((r) => ({
    id: r.id,
    structureType: r.structure_type as ReferralStructure,
    copy: (r.generated_copy as ReferralProgramCopy) ?? ({} as ReferralProgramCopy),
    implementedUrl: r.implemented_url,
    createdAt: r.created_at,
  }))
  return NextResponse.json({ ok: true, programs })
}
