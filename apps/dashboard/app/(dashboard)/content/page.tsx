import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { limitsFor } from '@/lib/tiers'
import type { GeneratedContentView, ContentType } from '@usersessions/shared'
import { ContentGenerator } from './ContentGenerator'

const TYPE_LABEL: Record<ContentType, string> = {
  vs_page: 'Vs page',
  best_tools_roundup: 'Best-tools roundup',
  alternative_post: 'Alternative post',
  faq_page: 'FAQ page',
}

/**
 * Comparison Content (Feature 2): AI-drafted, honest comparison/FAQ content the founder edits
 * and publishes on their own site. No fabricated benchmarks; schema.org suggestions included.
 */
export default async function ContentPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: profile }, { data: products }, { data: scans }, { data: existing }] = await Promise.all([
    supabase.from('profiles').select('plan').eq('id', user.id).maybeSingle(),
    supabase.from('products').select('id, name').order('name'),
    supabase.from('competitor_scans').select('competitor_name').order('scanned_at', { ascending: false }).limit(50),
    supabase
      .from('generated_content')
      .select('id, content_type, draft_markdown, published_url, ai_citation_count, created_at')
      .order('created_at', { ascending: false })
      .limit(20),
  ])

  const limits = limitsFor(profile?.plan)
  const competitors = [...new Set((scans ?? []).map((s) => s.competitor_name).filter(Boolean))].slice(0, 12)
  const items: GeneratedContentView[] = (existing ?? []).map((r) => ({
    id: r.id,
    contentType: r.content_type as ContentType,
    draftMarkdown: r.draft_markdown,
    publishedUrl: r.published_url,
    aiCitationCount: r.ai_citation_count,
    createdAt: r.created_at,
  }))

  return (
    <div className="flex flex-col" style={{ gap: 'var(--space-lg)', maxWidth: 820 }}>
      <header className="flex flex-col" style={{ gap: 'var(--space-xs)' }}>
        <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.75rem' }}>Comparison content</h1>
        <p className="font-sans-body">
          Draft honest “vs” pages, roundups, alternative posts and FAQs — the exact content AI
          assistants quote when buyers compare tools. Edit every word, then publish on your site.
        </p>
      </header>

      {limits.contentPerMonth === 0 ? (
        <div className="card" style={{ borderColor: 'var(--amber)' }}>
          <p className="font-mono-label" style={{ color: 'var(--amber)' }}>Content generation is a paid feature</p>
          <p className="font-sans-body">Upgrade to Founder or higher to generate comparison content.</p>
          <a href="/pricing" className="font-mono-micro" style={{ color: 'var(--primary)', textDecoration: 'none' }}>Upgrade →</a>
        </div>
      ) : (products ?? []).length === 0 ? (
        <div className="card"><p className="font-sans-body">Add a product first, then generate content.</p></div>
      ) : (
        <ContentGenerator products={products ?? []} competitors={competitors} />
      )}

      {items.length > 0 && (
        <div className="card card--dense flex flex-col" style={{ gap: 'var(--space-sm)' }}>
          <p className="font-mono-label">Saved drafts</p>
          {items.map((it) => (
            <div key={it.id} className="flex items-center" style={{ gap: 'var(--space-md)', borderTop: '1px solid var(--border)', paddingTop: 'var(--space-sm)' }}>
              <span className="font-mono-micro" style={{ color: 'var(--cyan)', width: 150 }}>{TYPE_LABEL[it.contentType]}</span>
              <span className="font-mono-micro" style={{ flex: 1 }}>{new Date(it.createdAt).toISOString().slice(0, 10)}</span>
              {it.publishedUrl ? (
                <a className="font-mono-micro" style={{ color: 'var(--primary)' }} href={it.publishedUrl} target="_blank" rel="noreferrer">published ↗</a>
              ) : (
                <span className="status-pending">draft</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
