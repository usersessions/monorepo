import * as cheerio from 'cheerio';
import { ProductInput } from './prompt-engine';

const _HEADERS = {
  'User-Agent': 'VideoAdGeneratorBot/1.0 (+https://usersessions.io/bot)',
};
const _TIMEOUT = 10000;

export class ScrapeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ScrapeError';
  }
}

export async function scrapeProduct(url: string): Promise<ProductInput> {
  const normalizedUrl = normalizeUrl(url);

  if (looksLikeShopifyProductUrl(normalizedUrl)) {
    try {
      return await scrapeShopify(normalizedUrl);
    } catch (err) {
      console.log(`Shopify JSON scrape failed for ${normalizedUrl} — trying generic scrape`, err);
    }
  }

  try {
    return await scrapeGeneric(normalizedUrl);
  } catch (err) {
    throw new ScrapeError(`Could not extract product data from ${normalizedUrl}: ${err}`);
  }
}

function normalizeUrl(url: string): string {
  let normalized = url.trim();
  if (!/^https?:\/\//i.test(normalized)) {
    normalized = 'https://' + normalized;
  }
  return normalized;
}

function looksLikeShopifyProductUrl(url: string): boolean {
  try {
    return new URL(url).pathname.includes('/products/');
  } catch (err) {
    return false;
  }
}

async function scrapeShopify(url: string): Promise<ProductInput> {
  const jsonUrl = toShopifyJsonUrl(url);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), _TIMEOUT);

  const res = await fetch(jsonUrl, { headers: _HEADERS, signal: controller.signal });
  clearTimeout(timeoutId);

  if (!res.ok) {
    throw new Error(`HTTP error! status: ${res.status}`);
  }

  const data = await res.json();
  const product = data.product;
  
  if (!product) {
    throw new ScrapeError("Shopify JSON response had no 'product' key");
  }

  const variants = product.variants || [];
  const price = variants.length > 0 ? variants[0].price : null;

  const images = (product.images || [])
    .map((img: any) => img.src)
    .filter(Boolean);

  return {
    title: product.title || '',
    description: stripHtml(product.body_html || ''),
    price: price,
    currency: null,
    category_hint: product.product_type,
    brand: product.vendor,
    image_urls: images.slice(0, 5),
  };
}

function toShopifyJsonUrl(url: string): string {
  const base = url.split('?')[0].split('#')[0].replace(/\/$/, '');
  return base.endsWith('.json') ? base : `${base}.json`;
}

function stripHtml(html: string): string {
  if (!html) return '';
  const $ = cheerio.load(html);
  return $.text().trim();
}

async function scrapeGeneric(url: string): Promise<ProductInput> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), _TIMEOUT);

  const res = await fetch(url, { headers: _HEADERS, signal: controller.signal });
  clearTimeout(timeoutId);

  if (!res.ok) {
    throw new Error(`HTTP error! status: ${res.status}`);
  }

  const html = await res.text();
  const $ = cheerio.load(html);

  function meta(...keys: string[]): string | null {
    for (const key of keys) {
      const content = $(`meta[property="${key}"]`).attr('content') || $(`meta[name="${key}"]`).attr('content');
      if (content && content.trim() !== '') {
        return content.trim();
      }
    }
    return null;
  }

  let title = meta('og:title', 'twitter:title');
  if (!title) {
    const titleTag = $('title').first().text();
    if (titleTag) title = titleTag.trim();
  }
  if (!title) {
    throw new ScrapeError("No title found via OpenGraph or <title>");
  }

  const description = meta('og:description', 'description', 'twitter:description') || '';
  const image = meta('og:image', 'twitter:image');
  const price = meta('product:price:amount', 'og:price:amount');
  const currency = meta('product:price:currency', 'og:price:currency');

  return {
    title: title,
    description: description,
    price: price,
    currency: currency,
    category_hint: null,
    brand: null,
    image_urls: image ? [image] : [],
  };
}
