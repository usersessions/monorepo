import type { ScrapedProduct } from '@/types/product'

const MODEL = process.env.GEMINI_MODEL ?? 'gemini-2.0-flash'

/** Drafts a text-to-video prompt from scraped product metadata. Founder edits/approves before generation. */
export async function generateVideoPrompt(product: ScrapedProduct): Promise<string> {
  const key = process.env.GEMINI_API_KEY
  if (!key) throw new Error('GEMINI_API_KEY not set')
  const instruction = `Write a single cinematic text-to-video prompt (under 120 words) for a short marketing video about this product. Concrete visuals only, no hype words, no on-screen text.\n\nProduct: ${product.title}\nDescription: ${product.description ?? 'n/a'}\nSite: ${product.site_name ?? product.url}`
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${key}`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: instruction }] }] }),
    }
  )
  if (!res.ok) throw new Error(`Gemini error: ${res.status}`)
  const data = (await res.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] }
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim()
  if (!text) throw new Error('Gemini returned no prompt')
  return text
}
