/**
 * Long-form guides (/articles). Server-rendered HTML content — readable by
 * humans, search engines and AI crawlers alike. StoryBrand voice throughout:
 * the founder is the hero, we are the guide. Zero fabricated numbers.
 * Enforces ANTI-AI-WRITING rules.
 */
export interface Article {
  slug: string
  title: string
  description: string
  date: string
  readingMinutes: number
  html: string
}

export function getArticle(slug: string): Article | undefined {
  return ARTICLES.find((a) => a.slug === slug)
}

export const ARTICLES: Article[] = [
  {
    slug: 'how-to-write-landing-pages-for-ai-video-extraction',
    title: 'How to Write Landing Pages That AI Video Generators Can Actually Read',
    description:
      'AI video generators rely on your landing page copy to write their scripts. If your page is vague, your video ad will be vague. Here is exactly how to structure your copy so the AI extracts a high-converting script.',
    date: '2026-07-22',
    readingMinutes: 5,
    html: `
<p>When you paste a URL into usersessions, the first thing our system does is send that URL to Google Gemini to extract your product positioning. It reads your hero section, your feature list, and your target audience.</p>
<p>If your landing page says "The future of data synergy," Gemini has no idea what you built. Consequently, the video script it writes will be a vague collage of corporate buzzwords. Your video will look cinematic, but it will sell nothing because it means nothing.</p>
<h2>State the mechanism, not the adjective</h2>
<p>AI models extract facts easily. They struggle to extract meaning from adjectives. If your page says "a fast, intuitive platform," the AI drops those words because they contain no structural information. If your page says "processes 10,000 rows in two seconds via WebAssembly," the AI recognizes a capability and writes it into the ad script.</p>
<p>Read your H1 and H2 tags. Do they describe what the software actually does? If a human cannot understand the product in three seconds, the model will fail to summarize it.</p>
<h2>Define the enemy</h2>
<p>A high-converting video ad needs conflict. The viewer needs to recognize their own pain point in the first three seconds of the video. The easiest way to ensure the AI writes a strong hook is to explicitly name the problem on your landing page.</p>
<p>Don't write "better project management." Write "stop losing client briefs in Slack threads." When the AI reads the second version, it immediately understands the pain point and builds the video script around that exact frustration.</p>
<h2>Check your own output</h2>
<p>Before you run a URL through the video generator, read the page out loud. If you stumble over a sentence, the AI will likely misinterpret it. Keep the language direct. State what the product is, who it is for, and how it works.</p>
`,
  },
  {
    slug: 'why-text-captions-matter-for-video-ads',
    title: 'Why Auto-Captions Are Non-Negotiable for Short-Form Video Ads',
    description:
      'A significant portion of mobile users watch video ads with the sound off. If your video lacks captions, the viewer scrolls past immediately. Here is why we enforce auto-captions on every video we generate.',
    date: '2026-07-22',
    readingMinutes: 4,
    html: `
<p>You can generate the highest-fidelity video ad possible, complete with a professional voiceover and cinematic lighting. If you post it to TikTok or Instagram Reels without text captions on the screen, you waste your ad spend.</p>
<h2>The sound-off default</h2>
<p>Mobile users scroll in public spaces, on transit, and in waiting rooms. Their devices are muted by default. When your video ad appears in their feed, they have one second to decide if it matters to them. If the hook is only delivered via the audio track, they scroll past it.</p>
<p>Text captions bridge this gap. They deliver the hook visually before the user decides whether to tap the volume button.</p>
<h2>Pacing and retention</h2>
<p>Short-form video algorithms measure watch time. Fast-paced, single-word captions force the viewer to read along, which artificially increases retention rates. This is a mechanical reality of how these platforms distribute content. Higher retention yields lower cost-per-click on paid ads and higher reach on organic posts.</p>
<p>This is why usersessions automatically generates captions for every video. We use the AI script to generate the text overlay, synced to the voiceover. You can edit the text before you download the file, ensuring every word is accurate.</p>
`,
  },
  {
    slug: 'evaluating-minimax-video-generation-model',
    title: 'The MiniMax Video Model: What It Does Well and Where It Fails',
    description:
      'We use the MiniMax Video-01 model to generate your ad frames. It is excellent at cinematic motion and terrible at rendering small text. Here is a realistic breakdown of what you can expect from the engine.',
    date: '2026-07-22',
    readingMinutes: 6,
    html: `
<p>AI video generation is a rapidly changing technology. We selected the MiniMax Video-01 model as our rendering engine because it currently offers the most reliable physics and character consistency. However, it has specific limitations that you need to account for when generating ads.</p>
<h2>Where the model succeeds</h2>
<p><strong>Cinematic lighting and motion.</strong> MiniMax handles complex camera movements, depth of field, and natural lighting exceptionally well. If the script calls for a "slow pan across a modern office desk," the result usually looks like actual b-roll footage.</p>
<p><strong>Human character consistency.</strong> Earlier models suffered from morphing faces and inconsistent anatomy. MiniMax maintains facial structures across standard 5-second generation windows, which makes it viable for ad creative.</p>
<h2>Where the model fails</h2>
<p><strong>Rendering UI and small text.</strong> Do not attempt to generate a direct screencast of your dashboard. The model cannot render legible UI text at a small scale. It will invent glyphs that look like text from a distance but are unreadable close up. If you need to show UI, use screen recording software. Use usersessions for the narrative b-roll and hook sequences.</p>
<p><strong>Complex physics interactions.</strong> If you prompt the model to show a person typing on a keyboard, it will succeed. If you prompt it to show a person juggling three specific objects while riding a bicycle, the physics will fail. Keep the physical actions in your ads simple.</p>
<h2>How we mitigate this</h2>
<p>When Gemini writes your video script, we specifically prompt it to avoid requesting UI screencasts or complex physics. The prompts are optimized to request the exact type of b-roll footage that MiniMax excels at generating. This produces a higher success rate per generation credit.</p>
`,
  },
  {
    slug: 'tiktok-vs-reels-video-ad-formats',
    title: 'TikTok vs. Reels: The Video Ad Format Guide for Founders',
    description:
      'Social video platforms have different audience expectations, but the technical formats are identical. This guide covers how to position your AI-generated videos across the major short-form networks.',
    date: '2026-07-22',
    readingMinutes: 4,
    html: `
<p>The technical specifications for TikTok, Instagram Reels, and YouTube Shorts are functionally identical. All three require a 9:16 aspect ratio, vertical orientation, and standard MP4 compression. When you download a video from usersessions, the file is technically ready for all three platforms.</p>
<p>The difference lies in the audience expectations.</p>
<h2>Platform expectations</h2>
<p><strong>TikTok</strong> rewards direct, unpolished hooks. The audience expects a fast-paced opening that immediately names the problem. Highly produced, cinematic ads often underperform here because they look like traditional television commercials, which prompts immediate skipping.</p>
<p><strong>Instagram Reels</strong> leans slightly more aesthetic. The cinematic b-roll that the MiniMax model produces performs exceptionally well on this surface. The audience tolerates a slightly slower pace if the visuals are striking.</p>
<p><strong>YouTube Shorts</strong> requires the fastest hook of the three. You have less than two seconds to establish the premise before the user swipes. Your auto-captions are critical here.</p>
<h2>How to test</h2>
<p>Do not generate three separate videos for the three platforms immediately. Generate one core video ad using usersessions. Export it, upload it to all three platforms organically, and measure the retention drop-off graphs in their respective creator dashboards.</p>
<p>The platform that retains the highest percentage of viewers at the three-second mark is where you should allocate your paid ad spend for that specific creative.</p>
`,
  }
]
