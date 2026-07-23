import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Force dynamic: Supabase URL is a runtime env var on Cloudflare, not a build var.
export const dynamic = 'force-dynamic'


type Ctx = { params: Promise<{ id: string }> }

export async function GET(_req: Request, context: Ctx) {
  const { id } = await Promise.resolve(context.params)
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const { data: video } = await supabase.from('videos').select('*').eq('id', id).eq('user_id', user.id).single()
  if (!video) return NextResponse.json({ error: 'not found' }, { status: 404 })
  return NextResponse.json({ video })
}

export async function DELETE(_req: Request, context: Ctx) {
  const { id } = await Promise.resolve(context.params)
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  await supabase.from('videos').delete().eq('id', id).eq('user_id', user.id)
  return NextResponse.json({ ok: true })
}
