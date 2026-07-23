import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateVideoPrompt } from '@/services/gemini'
import type { ScrapedProduct } from '@/types/product'

// Force dynamic: Supabase URL is a runtime env var on Cloudflare, not a build var.
export const dynamic = 'force-dynamic'


/** Repurposed from /api/ai/copy — drafts a text-to-video prompt; founder edits/approves before generating. */
export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const body = (await req.json().catch(() => null)) as { product?: ScrapedProduct } | null
  if (!body?.product?.url || !body.product.title) {
    return NextResponse.json({ error: 'product required' }, { status: 400 })
  }
  try {
    const prompt = await generateVideoPrompt(body.product)
    return NextResponse.json({ prompt })
  } catch {
    return NextResponse.json({ error: 'prompt generation failed' }, { status: 502 })
  }
}
