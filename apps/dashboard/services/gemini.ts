import type { ScrapedProduct } from '@/types/product'

const MODEL = process.env.GEMINI_MODEL ?? 'gemini-2.0-flash'

/** Drafts a cinematic text-to-video prompt from scraped product metadata. */
export async function generateVideoPrompt(product: ScrapedProduct): Promise<string> {
  const key = process.env.GEMINI_API_KEY
  if (!key) {
    return fallbackPrompt(product.title)
  }

  const instruction = `
You are an expert AI Cinematographer and Creative Director. Your job is to write a SINGLE cinematic text-to-video prompt optimized for the MiniMax (Hailuo) video engine based on the product provided.

CRITICAL MINIMAX (HAILUO) GUARDRAILS:
1. Under 120 words.
2. Single continuous camera shot (Max 10 seconds). Do NOT use multi-cut or editing language.
3. NO dialogue, NO lip-sync, NO text, NO UI overlays, NO logos.
4. NO split screens, NO crowds, NO abstract concepts.
5. Emphasize real-world physics: liquid motion, fabric drape, particle displacement, reflection, and tactile interactions.

STEP 1: DYNAMIC CATEGORY MATCHING
Analyze the product and select ONE of the following visual archetypes:
- Tech/Electronics -> "Big Tech / Hardware Monolith" (Apple Aesthetic: Dark, macro, light sweeps, brushed metal, probe lens)
- Fitness/Sports/Apparel/Durables -> "Kinetic Impact" (Nike Aesthetic: Slow-mo collision, particle shockwaves, sweat/dust, high-contrast)
- Skincare/Cosmetics/Jewelry -> "Sensory Flow" (Luxury Beauty Aesthetic: Extreme macro, fluid/fabric physics, volumetric light, surface tension)
- Everyday E-commerce/Gadgets -> "Tactile Mess" (UGC/ASMR Aesthetic: POV, satisfying physical interaction, squeeze/pop/smear, cluttered real environment)

STEP 2: ENFORCE THE VISUAL FORMULA
Your output MUST follow this exact structure (do not label the parts, just write it as one fluid paragraph):
[Camera Movement & Framing] + [Macro Subject Texture & Details] + [Physical Action / Kinetic Momentum / Pattern Interrupt] + [Lighting & Atmospheric Mood]

Use powerful pattern interrupts in the action phase (e.g., Anti-Gravity Reversal, Macro Misdirect, Sudden Illumination, Viscous Smear).

FEW-SHOT "GOD-TIER" EXAMPLES (Study these for rhythm and syntax):
- Tech: "Extreme macro probe lens glides along the edge of a matte black titanium smartwatch. A sharp beam of volumetric light sweeps across the beveled glass screen, revealing microscopic condensation droplets. The camera orbits 180 degrees as the watch seamlessly snaps into a sleek charging dock. Zero gravity physics cause a solitary drop of water to lift off the screen and shatter into a mist of micro-droplets against a pure black background."
- UGC/ASMR: "First-person POV, slight handheld camera shake. A cluttered, brightly lit bathroom countertop with scattered cotton pads. A hand enters the frame, aggressively squeezing a frosted plastic tube. A thick, viscous pink gel bursts out, oozing slowly and satisfyingly onto a clear glass palette. The weight of the gel causes it to fold over itself in thick ribbons. Morning sunlight casts harsh, natural shadows."
- Beauty/Flow: "Extreme close-up of a flawless, luminescent cheekbone bathed in diffuse softbox lighting. A glass dropper releases a single, heavy sphere of liquid gold serum. The thick droplet hits the skin, flattening and rippling outward with hyper-realistic surface tension. A gentle breeze causes fine, flyaway hairs to sway softly across the edge of the frame. Warm, volumetric god rays create an ethereal, glowing halo effect."

OUTPUT ONLY THE FINAL PROMPT TEXT. Do not explain your category choice.

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
