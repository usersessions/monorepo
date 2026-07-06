/**
 * Long-form guides (/articles). Server-rendered HTML content — readable by
 * humans, search engines and AI crawlers alike. StoryBrand voice throughout:
 * the founder is the hero, we are the guide. Zero fabricated numbers.
 */
export interface Article {
  slug: string
  title: string
  description: string
  date: string
  readingMinutes: number
  html: string
}

export const ARTICLES: Article[] = [
  {
    slug: 'get-your-ai-tool-listed-everywhere-chatgpt-looks',
    title: 'How to Get Your AI Tool Listed Everywhere ChatGPT Looks',
    description:
      'AI assistants assemble recommendations from directories, tool indexes and launch platforms. Here is the complete playbook for getting your product into every one of those surfaces — honestly, without spam.',
    date: '2026-07-06',
    readingMinutes: 8,
    html: `
<p>You shipped. The product works, the landing page is live, and you did the thing most people never do: you finished. And then — nothing. No signups, no mentions, no traffic. You built something real and it feels like it doesn't exist.</p>
<p>Here is the uncomfortable mechanic behind that silence: AI killed the barrier to building software, not the barrier to being found. When someone asks ChatGPT, Perplexity or Gemini for “the best AI tool for X”, those assistants don't search your landing page. They assemble answers from the surfaces they trust: directories, tool indexes, launch platforms, review sites. If your product isn't on those surfaces, you don't just rank low — you are structurally invisible to the way people discover software now.</p>
<h2>Where AI assistants actually look</h2>
<p>The discovery layer for AI tools is more concentrated than most founders assume. A handful of surfaces do most of the work:</p>
<ul>
<li><strong>AI tool indexes</strong> — sites like <a href='https://theresanaiforthat.com' rel='noopener'>There's An AI For That</a> and <a href='https://www.futurepedia.io' rel='noopener'>Futurepedia</a> exist specifically to catalog AI products, and they get crawled constantly.</li>
<li><strong>Startup launch platforms</strong> — <a href='https://www.producthunt.com' rel='noopener'>Product Hunt</a>, <a href='https://www.uneed.best' rel='noopener'>Uneed</a> and their peers create the launch-day signal and the durable listing page that outlives it.</li>
<li><strong>Community surfaces</strong> — maker communities where real usage gets discussed, which AI models treat as evidence that a product exists and works.</li>
</ul>
<p>Notice what is not on that list: your own blog, your own docs, your own homepage. Those matter for converting visitors — but they don't create the third-party citations that assistants weigh.</p>
<h2>The playbook, step by step</h2>
<p><strong>1. Get your copy right once, then adapt it per surface.</strong> An AI tool index wants capability and concrete use cases, stated factually. A launch platform wants the founder story and the problem you solved. Submitting identical copy everywhere is the most common self-inflicted wound — it reads as spam to editors and to models alike. Write one honest core description, then produce a per-category variant.</p>
<p><strong>2. Submit with your own accounts, in your own browser.</strong> Farmed accounts and automated account creation get products banned, and platforms have gotten very good at detecting them. Every listing should be traceable to you. This is slower. It is also the only version that compounds instead of collapsing.</p>
<p><strong>3. Track which listings actually go live.</strong> Submitting is not being listed. Editorial queues reject quietly, forms fail silently, and listings that were live go dead when platforms restructure. If you don't verify, your mental model of your own distribution is fiction within a month.</p>
<p><strong>4. Measure the outcome, not the activity.</strong> The question is never “how many directories am I on?” It is “when someone asks an AI assistant for a tool in my category, do I appear?” Check that question weekly, verbatim, across engines. When the answer changes, you'll know which listings moved it.</p>
<h2>What not to do</h2>
<p>No web 2.0 link farms. No domain-authority chasing. No paid “500 backlinks” packages. These are the leftovers of an SEO era that AI-mediated discovery has made worse than useless — assistants and search engines alike treat those footprints as negative signals. Google's own <a href='https://developers.google.com/search/docs/fundamentals/seo-starter-guide' rel='noopener'>Search Essentials guidance</a> has said for years what AI discovery now enforces mechanically: legitimate, editorially-reviewed placements beat volume every time.</p>
<h2>Doing it manually vs. doing it with usersessions</h2>
<p>Everything above can be done by hand. Founders have half-finished spreadsheets of directory URLs to prove it — usually abandoned around row twelve, because filling the same form for the fifteenth time is soul-crushing work in a founder's most expensive hours.</p>
<p>That grind is exactly what <a href='/'>usersessions</a> automates — assisted, not magical. The plan is three steps: <strong>1. Install</strong> the extension. <strong>2. Launch</strong> — approve your copy, we submit everywhere, in your own browser with your own accounts, while you handle CAPTCHAs and email confirmations. <strong>3. Watch</strong> — the dashboard verifies what went live, resubmits what dies, and tracks whether AI assistants mention you week over week. Every AI-generated word is editable before anything is submitted, and every number on your dashboard is computed from verified listings — never estimated, never invented.</p>
<p>When someone asks ChatGPT for a tool like yours, it recommends someone. The whole game is making sure that someone is you. <a href='/signup'>Get your product found</a> — or read <a href='/articles/directory-submissions-best-practices'>the submission best-practices guide</a> next.</p>
`,
  },
  {
    slug: 'directory-submissions-best-practices',
    title: "Directory Submissions Aren't Dead — You're Just Doing Them Wrong",
    description:
      'Directory submissions earned their bad reputation from spam-era tactics. Done honestly, they are the highest-leverage distribution work an early product can do. Here are the practices that separate listings that convert from listings that rot.',
    date: '2026-07-06',
    readingMinutes: 7,
    html: `
<p>Say “directory submissions” to anyone who did marketing in the 2010s and watch them wince. The phrase evokes link farms, $5 gig-site packages and pages of dead links pointing at abandoned domains. That reputation was earned — and it is also now wrong, for one structural reason: <strong>AI assistants cite directories.</strong> When ChatGPT or Perplexity recommends tools, the evidence trail runs straight through tool indexes, launch platforms and review sites. The tactic didn't die. The spam version of it did.</p>
<h2>Practice 1: Choose fifteen platforms, not one hundred and fifty</h2>
<p>The instinct is volume. The reality is that a small set of editorially-maintained platforms produces nearly all the value, and the long tail of zero-moderation directories produces nothing but dead links with your name on them. A focused wedge — the AI tool indexes plus the startup launch platforms, done perfectly — beats a hundred drive-by submissions every time. Quality of surface matters more than count of surfaces, because assistants weigh <em>where</em> you're listed, not how often.</p>
<h2>Practice 2: Write for the editor, not the algorithm</h2>
<p>Most serious platforms have a human or an editorial process between your form submission and a live listing. That person has seen ten thousand “revolutionary AI-powered platforms.” What gets approved: a factual capability statement, a concrete use case, a working product at the URL you submitted. What gets rejected: superlative soup, invented traction claims and descriptions that could apply to any product. If your hook doesn't tell the editor what the product actually does within one sentence, rewrite it.</p>
<h2>Practice 3: Adapt copy per platform category</h2>
<p>An AI index reader is evaluating capability: what does it do, what model does it use, what does it cost. A launch-platform reader is evaluating a story: who built this, why, what problem died because of it. The same product needs both framings. This is the single highest-leverage edit most founders never make — and it's why <a href='/'>usersessions</a> generates copy per platform category and then puts every word in front of you to edit before anything is submitted. You are the creative director; the tool is the intern who types fast.</p>
<h2>Practice 4: UTM-tag everything</h2>
<p>A listing you can't measure is a rumor. Every URL you submit should carry UTM parameters so that referral traffic shows up attributed in your own analytics. When a platform sends you signups, you'll know to invest there; when it sends nothing for a quarter, you'll know what that listing is actually worth. No tags, no learning.</p>
<h2>Practice 5: Verify, then keep verifying</h2>
<p>The half-life of a directory listing is shorter than anyone expects. Platforms restructure URLs, purge old categories and silently drop listings during redesigns. A listing that was live in March can 404 in June with no notification to you. The founders who win this channel treat listings as infrastructure to monitor, not a task to complete: check that submissions actually went live, check that live listings stay reachable, and resubmit when they die. This is tedious, mechanical, recurring work — which is precisely why it should be a system rather than a calendar reminder you'll ignore. The <a href='/'>usersessions</a> monitoring loop does the checking nightly, flags dead listings only after confirming the failure isn't transient, and queues resubmissions so a dead link is a status change, not a silent loss.</p>
<h2>Practice 6: Handle the human steps like a human</h2>
<p>CAPTCHAs, email confirmations, account creation — every serious platform has at least one deliberately human gate. Tools that promise to blast through those gates get products banned. The honest architecture is assisted automation: let software do the tedious 90% (form-filling, copy adaptation, tracking) and do the 10% that proves you're a person yourself. It costs you minutes and protects the accounts everything else depends on.</p>
<h2>The compounding effect</h2>
<p>Each verified listing is small on its own. Together they change the shape of your discovery surface: more third-party citations, more referral paths, more evidence for AI assistants assembling their next recommendation. Founders who do this well don't experience it as a growth hack — they experience it as the product finally <em>existing</em> in the places people look.</p>
<p>Start with the <a href='/articles/get-your-ai-tool-listed-everywhere-chatgpt-looks'>full distribution playbook</a>, check <a href='/pricing'>what the automated version costs</a>, or just <a href='/signup'>get your product found</a>.</p>
`,
  },
  {
    slug: 'how-to-check-if-chatgpt-recommends-your-product',
    title: 'AI Visibility: How to Find Out Whether ChatGPT Recommends Your Product',
    description:
      'People increasingly ask AI assistants what tools to use — and the assistants answer with confidence. Here is how to measure whether you appear in those answers, and what actually moves the needle when you don't.',
    date: '2026-07-06',
    readingMinutes: 7,
    html: `
<p>Somewhere right now, a person with exactly your customer's problem is typing it into ChatGPT and asking what tool to use. The assistant will answer in seconds, with confidence, naming two or three products. Either you're one of them or you're not — and most founders have never once checked.</p>
<h2>Why this metric matters more every month</h2>
<p>Discovery is migrating from search results pages to answer engines. A search result page gives you ten chances to be seen; an AI answer gives you three, phrased as a recommendation from something people treat as an expert. The failure mode is brutal and silent: when someone asks for a tool like yours and the assistant recommends someone else, you don't lose a ranking position — you lose the customer without ever knowing they existed.</p>
<h2>How to measure it honestly</h2>
<p><strong>Write the queries your customers actually ask.</strong> Not your brand name — nobody who doesn't know you asks about you by name. The queries that matter are category-shaped: “best AI tool for [the job your product does]”, “how do I [the problem you solve]”. Three to five of these cover most of your discoverable surface.</p>
<p><strong>Ask them across engines, on a schedule.</strong> ChatGPT, <a href='https://www.perplexity.ai' rel='noopener'>Perplexity</a> and Gemini assemble answers differently and cite different surfaces. One check on one engine is an anecdote. The same queries, every week, across all three — that's a measurement.</p>
<p><strong>Record the answers verbatim.</strong> Not “felt like we did better this week.” The exact snippet, the exact products named, whether you appeared and where. Verbatim records are the only defense against wishful memory — and a “not mentioned” week is a data point you need to see, not smooth over. This is a hard rule in <a href='/'>usersessions</a>: snippets are stored and displayed exactly as the assistant produced them, and weeks where you weren't mentioned are shown as exactly that.</p>
<h2>What actually moves the needle</h2>
<p>You cannot buy your way into an AI answer, and you cannot prompt-inject your way in either. What the engines demonstrably draw on:</p>
<ul>
<li><strong>Presence on the surfaces they cite.</strong> Tool indexes, launch platforms, review sites — the citation trail of most AI recommendations runs through exactly these. Being listed, accurately, on the credible ones is the foundation. (The <a href='/articles/get-your-ai-tool-listed-everywhere-chatgpt-looks'>distribution playbook</a> covers this end to end.)</li>
<li><strong>Consistent, factual descriptions everywhere.</strong> Models cross-reference. When your directory listing, your launch page and your homepage all describe the product the same accurate way, you're an easy entity to be confident about. When they conflict, you're noise.</li>
<li><strong>Real usage signals.</strong> Community discussion, reviews and citations that show actual humans using the product. These can't be faked at any scale worth having — which is precisely why they're weighted.</li>
</ul>
<h2>The realistic timeline</h2>
<p>Expect lag. Engines re-crawl and re-weigh their sources on their own schedules, so listings you create this week surface in answers weeks later, not tomorrow. This is a reason to start earlier, not a reason to skip measuring — without the weekly baseline, you'll never connect what you did to what changed. Track the score, tag your listing URLs so referrals show up in your own analytics, and read the trend over months.</p>
<h2>Make it a loop, not a project</h2>
<p>The founders who win AI visibility treat it as a loop: submit → verify → measure → fix what died → measure again. That loop is the entire architecture of <a href='/'>usersessions</a> — <strong>Install</strong> the extension, <strong>Launch</strong> your listings everywhere with copy you approved word by word, <strong>Watch</strong> the dashboard verify listings, resurrect dead ones and run your visibility queries weekly across engines with verbatim receipts.</p>
<p>When someone asks ChatGPT for a tool like yours, it recommends someone. <a href='/signup'>Make sure it's you</a> — or see <a href='/faq'>the FAQ</a> for how the whole system works.</p>
`,
  },
]

export function getArticle(slug: string): Article | undefined {
  return ARTICLES.find((a) => a.slug === slug)
}
