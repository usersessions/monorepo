import type { ScrapedProduct } from '@/types/product'

const MODEL = process.env.GEMINI_MODEL ?? 'gemini-2.0-flash'

/** Drafts a cinematic text-to-video prompt from scraped product metadata. */
export async function generateVideoPrompt(product: ScrapedProduct): Promise<string> {
  const key = process.env.GEMINI_API_KEY
  if (!key) {
    return fallbackPrompt(product.title)
  }

  const instruction = `
You are an expert video commercial director. Write a single cinematic text-to-video prompt for a marketing video about this product.
CRITICAL RULES:
1. 10-second maximum duration context.
2. NO text, captions, or logos in the video.
3. Make the product the hero of the shot.
4. Concrete visuals only (no abstract concepts or hype words).
5. NO lip movement or dialogue.
6. Under 120 words.
7. Anti-patterns: avoid fast cuts, crowds, mirrors, split screens, and complex hand choreography.

Use Hailuo-tuned vocabulary (e.g., dolly-in, orbit, macro, rack focus, soft volumetric lighting).
Adapt strategy based on inferred category (e.g., Beauty, Food/Beverage, Tech).

Product: ${product.title}
Description: ${product.description ?? 'n/a'}
Site: ${product.site_name ?? product.url}
`.trim()

  try {
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
    
    if (!text) return fallbackPrompt(product.title)
    
    // Defensive word cap
    const words = text.split(/\s+/);
    if (words.length > 130) {
      return words.slice(0, 130).join(' ') + '...';
    }
    return text;
  } catch (err) {
    return fallbackPrompt(product.title)
  }
}

function fallbackPrompt(title: string): string {
  return `A cinematic, ultra-realistic macro shot of the ${title} product resting on a clean studio pedestal. Soft volumetric lighting casts elegant shadows. The camera slowly dollies in, keeping the product perfectly in focus. High quality, 4k resolution, smooth motion, highly detailed.`
}

/** Drafts a social media caption using strict anti-AI writing guardrails. */
export async function generateCaption(title: string, prompt: string): Promise<string> {
  const key = process.env.GEMINI_API_KEY
  if (!key) {
    return `Check out our latest ad video for ${title}.`
  }

  const instruction = `
You are writing a short social media caption for a video ad.
Product Title: ${title}
Video Context: ${prompt}

CRITICAL ANTI-AI WRITING RULES:
1. Banned vocabulary (DO NOT USE ANY OF THESE): delve, robust, seamless, seamlessly, testament, pivotal, crucial, vibrant, landscape, tapestry, underscore, showcase, foster, garner, intricate, align with, enhance, groundbreaking, breathtaking, nestled, boasts, serves as, stands as, unlock, leverage, empower, synergy, ecosystem.
2. Zero fabricated numbers, statistics, or claims of scale.
3. No "not just X, it's Y" constructions.
4. Use "is/are" instead of "serves as/boasts/features".
5. No em dashes — convert to periods or commas.
6. No emoji, no title-case headers.
7. No chatbot artifacts ("hope this helps", "let us know").
8. No sycophantic openers ("Great news!").
9. State concrete, specific facts.
10. The caption must sound natural and human, as if written by the founder. Max 2-3 sentences.
`.trim()

  try {
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
    
    if (!text) return `Here is the latest video ad for ${title}.`
    return text
  } catch (err) {
    return `Here is the latest video ad for ${title}.`
  }
}
