# ANTI-AI-WRITING.md — usersessions.io Copy Generation Guardrails

**This file governs every piece of AI-generated text in the product: platform submission copy, notification titles/bodies, weekly digest emails, empty states, and the homepage. Read it before writing any prompt that generates user-facing copy, and check output against it before it ships.**

Source: Wikipedia's "Signs of AI writing" (WikiProject AI Cleanup), adapted for a product where every generated word is reviewed by a founder before it goes anywhere public. This is not a style preference — it's a functional requirement. Section 1 of BUILD_SPEC already bans fabricated numbers and inflated claims in marketing copy; this file is the mechanical enforcement of that rule at the sentence level.

---

## Why this matters for this specific product

usersessions.io's entire pitch is "real data, honestly presented." A submission description that reads like inflated AI marketing copy — "a vibrant testament to innovation," "seamlessly integrating cutting-edge features" — actively works against the product's own positioning, on the platform it's submitted to and in the eyes of the founder reviewing it before approval. If the copy sounds like every other AI-generated directory listing, it fails the product's own StoryBrand promise before a human ever reads it.

This applies to three distinct copy surfaces, each with slightly different stakes:
- **Platform submission copy** (the Gemini-generated hook/body a founder reviews and edits) — must sound like the founder wrote it, because the founder is about to put their name on it
- **Notifications, digests, empty states** — must sound like a straight-shooting product, not a hype machine
- **Homepage/marketing** — held to the highest bar, since BUILD_SPEC Section 13 requires zero fabricated numbers and real screenshots only; inflated language here is a trust violation, not just bad style

---

## The core mechanism (read this once, understand why the checklist works)

LLMs generate the statistically most likely next token. That process converges on the same phrases, the same three-item lists, the same em-dash rhythm, regardless of who's asking or what the topic is. The tells below aren't a style guide — they're the fingerprint of that convergence. Removing them isn't decoration; it's removing the evidence that no particular person actually thought about this sentence.

---

## PART 1 — Banned Vocabulary (grep for these before shipping any generated copy)

If any of these words appear in Gemini output, rewrite the sentence — don't just swap the word for a synonym, since synonym-cycling is itself pattern #11 below.

```
delve, robust, seamless, seamlessly, testament, pivotal, crucial, vibrant,
landscape (abstract), tapestry (abstract), underscore (verb), showcase (verb),
foster/fostering, garner, intricate/intricacies, align with, enhance,
groundbreaking, breathtaking, nestled, boasts, stands as, serves as,
represents a, marks a shift, key turning point, evolving, cutting-edge,
game-changer/game-changing, unlock/unlocking (figurative), leverage (verb),
empower/empowering, holistic, synergy, ecosystem (figurative), journey (figurative)
```

**Extension-specific addition**: never let generated platform copy claim the product does something it doesn't. "Seamlessly automates your entire distribution" is banned twice over — once for "seamlessly," once because Section 1 of BUILD_SPEC explicitly requires marketing the product as *assisted* automation, never 100% hands-off. Vocabulary and honesty violations often travel together — check for both in the same sentence.

---

## PART 2 — Structural Patterns to Catch and Fix

### Content-level patterns

**1. Significance inflation** — assigning importance the facts don't support.
❌ "This listing marks a pivotal step in your product's journey to market visibility."
✅ "Your product is now listed on BetaList."

**2. Vague attribution** — citing "experts" or "industry reports" with no actual source.
❌ "Experts agree that distribution is the modern moat."
✅ Cite the specific claim with a real number, or cut it. usersessions.io has real data (survival rates, quality scores) — use it instead of invented authority.

**3. Formulaic "challenges" framing** — every AI-written product description eventually says "despite challenges, X continues to thrive."
❌ "Despite the crowded AI tools market, [Product] continues to stand out."
✅ State what the product actually does differently. If there's nothing specific to say, say less.

**4. Promotional language in copy that's supposed to be factual.**
❌ "A stunning, must-try tool for modern founders."
✅ "A Chrome extension that submits your product to 20+ startup directories."

**5. Rule of three** — forcing every list into exactly three items whether or not three is the right number.
❌ "Fast, reliable, and intuitive."
✅ Use however many items the thing actually has. Two is fine. Five is fine.

### Language-level patterns

**6. Copula avoidance** — replacing "is/are" with "serves as/boasts/features" to sound more sophisticated.
❌ "The dashboard serves as your command center for distribution."
✅ "The dashboard is where you track every listing."

**7. Negative parallelism / tailing negations** — "It's not just X, it's Y" and fragments like "no guessing."
❌ "It's not just a directory submission tool — it's a distribution engine."
✅ "It submits your product to directories automatically."

**8. Synonym cycling (elegant variation)** — swapping words to avoid repetition even when repetition is clearer.
❌ "The founder... the entrepreneur... the builder... the creator eventually gets listed."
✅ Pick one term and reuse it. "The founder" three times is more readable than four different words for the same person.

**9. False ranges** — "from X to Y" where X and Y aren't actually on a meaningful scale.
❌ "From your first launch to full AI visibility tracking."
✅ Name the two things directly without the fake-scale framing.

**10. Passive voice hiding the actor.**
❌ "Your product is submitted automatically."
✅ "The extension submits your product automatically." (Name what's doing the action — especially important here, since vague passive voice is how "assisted automation" quietly drifts into sounding like "fully automated," which BUILD_SPEC bans.)

### Style-level patterns

**11. Em dash overuse.** Every dash in generated copy gets checked — most convert cleanly to a period, comma, or parenthesis.

**12. Boldface, emoji, and title-case headers in body copy.** Notifications and digest emails are the highest-risk surface for this — a "🚀 New Platform Added!" notification title is an instant AI-tell. Use plain sentence case: "A new platform was added to your catalog."

**13. Signposting / announcing what you're about to say.**
❌ "Here's what you need to know about your Distribution Score:"
✅ Just say what the Distribution Score is.

**14. Fragmented headers** — a heading immediately followed by a sentence that just restates the heading.
❌ "## Your Weekly Digest \n Here's your weekly digest."
✅ "## Your Weekly Digest \n [the actual content]"

### Communication-level patterns (highest risk in notifications/emails)

**15. Chatbot artifacts** — anything that sounds like it's talking to the person mid-conversation rather than stating a fact.
❌ "We hope this update helps! Let us know if you have questions."
✅ Cut it entirely, or replace with a real, specific next action.

**16. Sycophantic tone** — has no place in a product notification. usersessions.io never says "Great news!" It says what happened.
❌ "Great news! Your listing on Futurepedia went live! 🎉"
✅ "Your Futurepedia listing is live."

**17. Hedging and filler.**
❌ "In order to fully take advantage of this feature, it is important to note that..."
✅ "To use this feature,..."

**18. Generic positive conclusions.**
❌ "The future of your distribution looks bright."
✅ State the next concrete fact or action, or end the sentence.

---

## PART 3 — Product-Specific Rules (beyond the general Wikipedia list)

These are not in the source material — they're specific to what would break this product's own stated promises if AI-generated copy violated them.

**No fabricated numbers, ever, in any surface.** This is stricter than the general "avoid vague claims" rule above — it's an absolute. If Gemini generates "Join thousands of founders" or "95% of users see results," that is not a style problem, it's a policy violation per BUILD_SPEC Section 1 and Section 13. Any generated sentence containing a number must be checked against a real data source before it ships. If there's no real number, the sentence gets cut, not softened.

**Never claim 100% automation.** "Assisted automation" is the load-bearing phrase in BUILD_SPEC Section 1. Any generated copy implying the human isn't in the loop — "fully automated," "hands-off," "set it and forget it" — is both an AI-vocabulary violation (these are marketing clichés) and a factual misrepresentation of the product.

**Never use "backlinks," "Domain Authority," "SEO," or "Trust Score."** These are banned product vocabulary per BUILD_SPEC Section 6/Operating Rule 7, separate from the AI-writing patterns above. A generated sentence can pass every check in Parts 1 and 2 and still be wrong if it uses banned product terminology instead of "Listings," "Platform Quality Score," and "Distribution Score."

**Platform submission copy must sound like the specific founder, not like every other AI-generated directory listing.** This is the highest-stakes surface, because two different founders submitting to the same platform with unedited AI output should not read like the same person wrote both. If the Voice Calibration process below isn't run, at minimum vary sentence rhythm and avoid the exact same opening structure ("[Product] is a [category] tool that helps [audience] [verb]...") that Gemini defaults to for every product.

---

## PART 4 — The Three-Pass Process (run this on every AI-generated copy block before it's shown for founder approval)

### Pass 1 — Voice
Before fixing anything structural, make sure there's an actual voice:
- Does it sound like a specific product, or could this description apply to five different tools with the names swapped?
- Is there one concrete, specific detail (a real feature, a real number if verified, a real use case) rather than only abstract claims?
- Would a founder reading this recognize their own product, or does it feel generic enough that they'd need to double-check it's actually about them?

### Pass 2 — Pattern removal
Run the full checklist from Parts 1 and 2 above. Grep the banned vocabulary list literally — don't rely on a human catching it by eye.

### Pass 3 — Audit
Ask directly: **"What in this text would make a founder think 'an AI wrote this,' or make a platform's spam filter flag it as generic bulk-submitted content?"**
Answer in one or two lines. Then do one more revision pass fixing exactly what was named.

---

## PART 5 — Quick Reference Checklist (paste this at the end of the generation prompt)

Before returning generated copy, confirm:

- [ ] Zero words from the Part 1 banned vocabulary list
- [ ] Zero fabricated numbers, statistics, or claims of scale
- [ ] No "not just X, it's Y" constructions
- [ ] No rule-of-three lists unless three is genuinely the right count
- [ ] "Is/are" used instead of "serves as/boasts/features"
- [ ] No em dashes — converted to periods, commas, or parentheses
- [ ] No emoji, no bold-header-as-list-item, no title-case headers in body text
- [ ] No signposting ("here's what you need to know," "let's look at")
- [ ] No chatbot artifacts ("hope this helps," "let us know")
- [ ] No sycophantic openers ("Great news!")
- [ ] No claim of full/seamless/100% automation — "assisted" only
- [ ] No banned product terms: backlinks, Domain Authority, SEO, Trust Score
- [ ] At least one concrete, specific, product-real detail present
- [ ] Read it aloud test: does this sound like a person describing their own product, or like a template with the name filled in?

If any box fails, revise before returning the copy for founder review. Founder edits after this point are expected and captured via `edits_telemetry` — but the AI-tell check happens before the founder ever sees the draft, not after.
