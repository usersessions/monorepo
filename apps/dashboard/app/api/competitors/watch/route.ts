import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/** CRUD for saved competitor watches — the recurring version of the manual scanner. */

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data } = await supabase
    .from('competitor_watches')
    .select('*')
    .order('created_at', { ascending: false })
  return NextResponse.json({ watches: data ?? [] })
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => null)
  const { query, competitorName, competitorUrl } = body ?? {}
  if (typeof query !== 'string' || typeof competitorName !== 'string' || typeof competitorUrl !== 'string') {
    return NextResponse.json({ error: 'Missing parameters' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('competitor_watches')
    .insert({
      user_id: user.id,
      query: query.slice(0, 300),
      competitor_name: competitorName.slice(0, 200),
      competitor_url: competitorUrl.slice(0, 500),
    })
    .select()
    .single()
  if (error) return NextResponse.json({ error: 'Failed to create watch' }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => null)
  if (typeof body?.id !== 'string') return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  await supabase.from('competitor_watches').delete().eq('id', body.id).eq('user_id', user.id)
  return NextResponse.json({ ok: true })
}
