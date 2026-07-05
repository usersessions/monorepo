import type { MetadataRoute } from 'next'

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://usersessions.io'

const PUBLIC_PATHS = ['/home', '/pricing', '/signup', '/login', '/support', '/terms', '/privacy']

export default function sitemap(): MetadataRoute.Sitemap {
  return PUBLIC_PATHS.map((path) => ({
    url: `${SITE}${path}`,
    changeFrequency: 'weekly' as const,
    priority: path === '/home' ? 1 : 0.7,
  }))
}
