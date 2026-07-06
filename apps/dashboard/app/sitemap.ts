import type { MetadataRoute } from 'next'
import { ARTICLES } from '@/lib/articles'

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://usersessions.io'

const PUBLIC_PATHS = ['/', '/home', '/pricing', '/signup', '/login', '/support', '/terms', '/privacy', '/articles', '/faq']

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    ...PUBLIC_PATHS.map((path) => ({
      url: `${SITE}${path}`,
      changeFrequency: 'weekly' as const,
      priority: path === '/' ? 1 : 0.7,
    })),
    ...ARTICLES.map((a) => ({
      url: `${SITE}/articles/${a.slug}`,
      changeFrequency: 'monthly' as const,
      priority: 0.8,
    })),
  ]
}
