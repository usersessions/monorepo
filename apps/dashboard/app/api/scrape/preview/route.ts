import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { scrapeProductPage } from '@/services/scraper'

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const body = (await req.json().catch(() => null)) as { url?: string } | null
  const url = body?.url
  if (!url || !/^https?:\/\//i.test(url)) {
    return NextResponse.json({ error: 'valid http(s) url required' }, { status: 400 })
  }
  try {
    const product = await scrapeProductPage(url)
    return NextResponse.json({ product })
  } catch {
    return NextResponse.json({ error: 'scrape failed' }, { status: 502 })
  }
}
