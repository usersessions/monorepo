# SUBMISSION-CONTENT.md — What usersessions.io Is Allowed to Submit to Other Platforms

**This file governs the copy that actually leaves the extension and lands on a third-party platform — ProductHunt posts, BetaList taglines, G2 listings, Dev.to launch posts, every hook/body generated for every adapter. It is a different document from ANTI-AI-WRITING.md, which governs how our own product sounds (notifications, digests, homepage). This file governs the consequences of what we put on someone else's site, under a real founder's real account, with their name on it.**

Read this before writing or editing any prompt in `brain.ts` that generates platform submission copy, and before approving any adapter's default copy-injection behavior.

---

## Why this is a separate file from ANTI-AI-WRITING.md

The stakes are different in kind, not just degree.

If a notification email sounds slightly robotic, the cost is a slightly worse product feel. If submission copy sounds like bulk-generated spam, the cost is the founder's actual account getting banned on a platform they may use for years — and per BUILD_SPEC's own risk register, "spam-tool perception (Money Robot lineage)" is a named existential risk to the whole product. A single platform ban traces back to us. A pattern of bans across many users gets the entire submission network blacklisted, which is the failure mode this product exists specifically to avoid.

ANTI-AI-WRITING.md asks "does this sound like a person wrote it." This file asks "if a platform moderator, a spam filter, or the founder's own future self reads this in six months, does it hold up." Both questions matter. This one has sharper teeth.

---

## Part 1 — The Absolute Rules (violating any of these blocks submission, no exceptions, no founder override)

These are not style preferences the founder can edit away in the Review & Edit UI. If generated copy trips any of these, the copy is regenerated before it's ever shown to the founder for approval — these are pre-approval filters, not post-approval suggestions.

### 1.1 — Zero fabricated facts about the product
No generated submission copy may state a number, a customer count, a feature, an integration, or a claim that isn't verifiably true of the actual product being submitted. This is stricter than "don't round up" — it means don't invent at all.

❌ "Trusted by thousands of founders worldwide."
❌ "Integrates with all major CRMs."
✅ Whatever the scraped `SiteData` and founder-provided context actually support. If the product page doesn't say it, the submission copy doesn't say it either.

**Mechanism**: every factual claim in generated copy must trace back to either the scraped site content or explicit founder input from the Review & Edit step. If it can't be traced, cut it.

### 1.2 — Never claim capabilities the extension itself doesn't have
This is the platform's own product, submitting itself — recursion risk is real. If usersessions.io is submitting itself to a directory, the copy describing usersessions.io is held to this same file. "Fully automated distribution" is banned for the same reason it's banned everywhere else in BUILD_SPEC: it isn't true, and a directory moderator fact-checking a submission about an automation tool is exactly the reviewer most likely to catch the lie.

### 1.3 — No content that could read as a bot wrote it, *specifically because that triggers platform-level bans, not just human disapproval*
Every check in ANTI-AI-WRITING.md Parts 1 and 2 applies here at a stricter threshold. On a personal blog, an em dash or a "seamlessly integrates" is a style flaw. On a bulk-submission target like BetaList or SaaSHub, generic AI-pattern language is a documented signal these platforms' own spam-detection systems are tuned to catch. Treat every pattern in that file as a submission-blocking check here, not a suggestion.

### 1.4 — No identical copy across platforms
Every adapter category (startup, ai, saas, dev, web2 — wait, no web2, see Part 3) gets its own generated hook and body per BUILD_SPEC Section 7 ("Gemini generates platform-category copy"). Submitting the exact same paragraph to five different directories is itself a spam signal independent of the copy's quality — search engines and some directories cross-reference duplicate listing text across their own and competitors' catalogs. Category-specific generation isn't just about tone-matching the audience; it's a structural anti-detection requirement.

### 1.5 — Never impersonate, never fabricate a persona
Generated copy never invents a founder backstory, a fake team size, a fake location, or a fake "we've been building this since [year]" narrative unless the founder explicitly provided that detail. The product's own StoryBrand guide-empathy line is "built by a founder who shipped app after app and hit the same wall" — that's true of us. It is not automatically true of every user, and copy must never manufacture a personal narrative on their behalf.

---

## Part 2 — Platform-Category-Specific Rules

Different platform categories have different tolerance, different review processes, and different failure modes. One tone does not fit all of them, and BUILD_SPEC already requires per-category generation — this section is what should actually differ between categories, not just vocabulary.

### Startup/launch platforms (ProductHunt-class, BetaList-class, MicroLaunch-class)
- Founder voice, first person is appropriate ("I built this because...")
- A real reason for building is expected and rewards genuine specificity — vague ("I saw a gap in the market") reads worse here than almost anywhere else, because this audience specifically rewards concrete founder stories
- Self-deprecation and honest limitation-naming ("still early, no mobile app yet") perform better on these platforms than confident claims — the audience is other builders who are skeptical of polish
- **Hard rule**: never write a first launch-day comment that reads like it's soliciting upvotes ("please upvote if you find this useful!"). This is against most of these platforms' own guidelines independent of our rules, and gets posts removed.

### AI tool directories (Futurepedia-class, TAAFT-class, AIToolsDirectory-class)
- Direct capability statements are expected and appropriate here — this audience is comparison-shopping, so vague copy actively underperforms
- State exactly what the AI does, not what it "empowers you to unlock" — see ANTI-AI-WRITING.md Part 1 banned vocabulary, doubly enforced here because this category is saturated with exactly that kind of copy and standing out means being concrete where competitors are vague
- Never claim a specific AI model or capability the product doesn't actually use. If the product uses Gemini, say Gemini. Don't say "advanced AI" if the specific model is known and could be named.

### SaaS review platforms (G2-class, Capterra-class, AlternativeTo-class)
- These are the platforms with actual human moderation and the highest ban-risk for anything that reads as promotional rather than descriptive
- Write like a feature list a procurement person would scan, not like ad copy
- **Hard rule**: never write anything that could be read as a fake review or fake testimonial. These platforms exist to host genuine user reviews — a vendor writing something that could pass as user-generated content is a serious trust and often Terms-of-Service violation, separate from anything about AI-writing quality
- Comparison framing ("an alternative to X") must be factually accurate about what the product actually competes with — don't generate a comparison to a tool the product doesn't genuinely resemble just because that tool is popular

### Developer communities (Dev.to-class, Hacker News Show-HN-class)
- Technical specificity is rewarded; marketing language is actively punished by this audience
- Show HN in particular has strict community norms against anything promotional — the existing `hn.ts` adapter's title-format handling already reflects this; the generated body text must match that register
- Never generate a post that asks for upvotes, shares, or "spreads the word" — this is against Hacker News guidelines specifically and reads as transparently bad-faith to this audience faster than almost any other platform on the list

---

## Part 3 — Structural Bans (product-policy level, not writing-style level)

These are already law per BUILD_SPEC's Operating Rules and are restated here because they intersect directly with what content generation is allowed to produce:

- **No web2 platform targeting exists in this product's catalog.** If a generated adapter or prompt ever targets a "web2 property" category, that's not a copy problem, it's a catalog violation — flag it and stop, don't generate copy for it.
- **No content generated for a platform requiring automated account creation.** Per BUILD_SPEC, account creation is human-in-the-loop only. If a copy-generation prompt is being built for a flow that would auto-create an account rather than assist a human through creating one, that's an architecture violation upstream of anything about the copy's wording.
- **No proxy-related content, ever**, per the same permanent ban.

---

## Part 4 — The Pre-Submission Checklist (runs before copy is shown in the Review & Edit UI)

This is stricter and runs *earlier* than the ANTI-AI-WRITING.md checklist — that file's checklist runs on copy about to be shown to a user. This checklist runs on copy about to be shown to a user *specifically because it's about to be submitted somewhere external*, so it includes everything from that file plus the submission-specific checks below.

- [ ] Every factual claim traces to scraped `SiteData` or explicit founder input — nothing invented
- [ ] No claim of full/seamless automation anywhere, including in copy describing usersessions.io itself
- [ ] Copy is unique to this platform category — not reused verbatim from another category's generation
- [ ] No fabricated founder backstory, team size, location, or history
- [ ] Platform-category tone rules from Part 2 followed for the specific target
- [ ] No solicitation for upvotes/shares/reviews embedded in the copy
- [ ] No fake-testimonial or fake-review framing on review-platform submissions
- [ ] No comparison claims ("alternative to X") that aren't genuinely accurate
- [ ] Full ANTI-AI-WRITING.md Part 5 checklist also passes — this file adds to that one, it doesn't replace it
- [ ] If any box fails: regenerate before this copy ever reaches the founder's Review & Edit screen. A founder should never have to catch a policy violation we could have caught first — their editing pass is for voice and accuracy, not for cleaning up submission-safety failures we should have already filtered out.

---

## Part 5 — What Happens When a Founder Edits Anyway

The founder can still edit any approved copy further in the Review & Edit UI — that's the product's core "creative director" principle and it's never overridden by this file. This file governs what Gemini is allowed to *generate and present* for approval, not what a human is allowed to *write themselves*. If a founder deliberately writes something that would fail this checklist, that's their account and their choice — `edits_telemetry` still captures the diff either way, and that data point (a founder overriding a safety-filtered draft) is itself useful signal for refining what Part 1–3 catch versus over-catch in future prompt revisions.
