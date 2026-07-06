import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ARTICLES, getArticle } from '@/lib/articles'
import { MarketingFooter } from '@/components/MarketingFooter'

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://usersessions.io'

export function generateStaticParams() {
  return ARTICLES.map((a) => ({ slug: a.slug }))
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const article = getArticle(slug)
  if (!article) return {}
  return {
    title: `${article.title} — usersessions`,
    description: article.description,
    openGraph: { title: article.title, description: article.description, type: 'article' },
  }
}

export default async function ArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const article = getArticle(slug)
  if (!article) notFound()

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: article!.title,
    description: article!.description,
    datePublished: article!.date,
    url: `${SITE}/articles/${article!.slug}`,
    publisher: { '@type': 'Organization', name: 'usersessions', url: SITE },
  }

  return (
    <main style={{ maxWidth: 720, margin: '0 auto', padding: 'var(--space-2xl) var(--space-lg)' }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <Link href="/" className="italic" style={{ fontFamily: 'var(--font-serif)', fontSize: '1.25rem', color: 'var(--paper)', textDecoration: 'none' }}>
        usersessions
      </Link>
      <p className="font-mono-micro" style={{ margin: 'var(--space-xl) 0 var(--space-xs)' }}>
        <Link href="/articles" style={{ color: 'var(--primary)', textDecoration: 'none' }}>← All guides</Link>
        {' · '}{article!.date} · {article!.readingMinutes} min read
      </p>
      <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: '2rem', marginBottom: 'var(--space-lg)' }}>{article!.title}</h1>
      <div className="article-body font-sans-body" dangerouslySetInnerHTML={{ __html: article!.html }} />
      <div className="card" style={{ marginTop: 'var(--space-xl)', display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
        <p className="font-sans-body" style={{ color: 'var(--paper)' }}>Your product is built. Now get it found.</p>
        <Link href="/signup" className="btn-primary" style={{ textAlign: 'center', textDecoration: 'none' }}>Get your product found</Link>
      </div>
      <MarketingFooter />
    </main>
  )
}
