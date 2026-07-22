import Link from 'next/link'
import { ARTICLES } from '@/lib/articles'
import { MarketingFooter } from '@/components/MarketingFooter'

export const metadata = {
  title: 'Guides — usersessions',
  description: 'Long-form guides on distribution, AI video ad generation and AI visibility for founders. Get your product found.',
}

export default function ArticlesPage() {
  return (
    <main style={{ maxWidth: 720, margin: '0 auto', padding: 'var(--space-2xl) var(--space-lg)' }}>
      <Link href="/" className="italic" style={{ fontFamily: 'var(--font-serif)', fontSize: '1.25rem', color: 'var(--paper)', textDecoration: 'none' }}>
        usersessions
      </Link>
      <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: '2rem', margin: 'var(--space-xl) 0 var(--space-sm)' }}>Guides</h1>
      <p className="font-sans-body" style={{ marginBottom: 'var(--space-xl)' }}>
        Distribution, AI video ad generation and AI visibility — written for founders who ship.
      </p>

      <div className="flex flex-col" style={{ gap: 'var(--space-lg)' }}>
        {ARTICLES.map((a) => (
          <article key={a.slug} className="card flex flex-col" style={{ gap: 'var(--space-xs)' }}>
            <Link href={`/articles/${a.slug}`} style={{ textDecoration: 'none', color: 'var(--paper)' }}>
              <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.25rem' }}>{a.title}</h2>
            </Link>
            <p className="font-sans-body">{a.description}</p>
            <p className="font-mono-micro">{a.date} · {a.readingMinutes} min read</p>
          </article>
        ))}
      </div>

      <MarketingFooter />
    </main>
  )
}
