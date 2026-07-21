import type { ScrapedProduct } from '@/types/product'

function metaFrom(html: string, key: string): string | null {
  const a = new RegExp("<meta[^>]+(?:property|name)=[\"']" + key + "[\"'][^>]*content=[\"']([^\"']*)[\"']", 'i')
  const b = new RegExp("<meta[^>]+content=[\"']([^\"']*)[\"'][^>]*(?:property|name)=[\"']" + key + "[\"']", 'i')
  return html.match(a)?.[1] ?? html.match(b)?.[1] ?? null
}

/** Server-side product page scraper for the generate flow preview. */
export async function scrapeProductPage(url: string): Promise<ScrapedProduct> {
  const res = await fetch(url, {
    headers: { 'user-agent': 'Mozilla/5.0 (compatible; usersessions-preview)' },
    redirect: 'follow',
  })
  if (!res.ok) throw new Error(`Fetch failed: ${res.status}`)
  const html = (await res.text()).slice(0, 500_000)
  const title = metaFrom(html, 'og:title') ?? html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1]?.trim() ?? url
  return {
    url,
    title,
    description: metaFrom(html, 'og:description') ?? metaFrom(html, 'description'),
    image_url: metaFrom(html, 'og:image'),
    site_name: metaFrom(html, 'og:site_name'),
    price: metaFrom(html, 'product:price:amount'),
  }
}
