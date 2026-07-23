import { NextResponse } from 'next/server'
import { requireAdminApi } from '@/lib/admin-api'
import { createServiceClient } from '@/lib/supabase/server'

// Force dynamic: Supabase URL is a runtime env var on Cloudflare, not a build var.
export const dynamic = 'force-dynamic'


export type SearchResult = { category: string; id: string; label: string; href: string }

// Global admin search across users, products (campaign proxy), platforms, tickets.
export async function GET(request: Request) {
  const user = await requireAdminApi()
  if (!user) return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 })

  const q = (new URL(request.url).searchParams.get('q') ?? '').trim()
  if (q.length < 2) return NextResponse.json({ results: [] })
  const term = `%${q.replace(/[%_,()]/g, '')}%`

  const db = createServiceClient()
  const [users, products, platforms, tickets] = await Promise.all([
    db.from('profiles').select('id, email, full_name').or(`email.ilike.${term},full_name.ilike.${term}`).limit(10),
    db.from('products').select('id, name, user_id').ilike('name', term).limit(10),
    db.from('platforms').select('id, name').ilike('name', term).limit(10),
    db.from('support_tickets').select('id, subject').ilike('subject', term).limit(10),
  ])

  const results: SearchResult[] = [
    ...(users.data ?? []).map((u) => ({ category: 'Users', id: u.id, label: u.full_name ? `${u.email} (${u.full_name})` : u.email, href: `/admin/users/${u.id}` })),
    ...(products.data ?? []).map((p) => ({ category: 'Products', id: p.id, label: p.name, href: `/admin/users/${p.user_id}` })),
    ...(platforms.data ?? []).map((p) => ({ category: 'Platforms', id: p.id, label: p.name, href: `/admin/adapters?platform=${p.id}` })),
    ...(tickets.data ?? []).map((t) => ({ category: 'Support', id: t.id, label: t.subject, href: '/admin/support' })),
  ]
  return NextResponse.json({ results })
}
