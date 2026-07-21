'use client'

import { useState } from 'react'
import type { ScrapedProduct } from '@/types/product'

export function useProductScrape() {
  const [product, setProduct] = useState<ScrapedProduct | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function scrape(url: string) {
    setLoading(true)
    setError(null)
    setProduct(null)
    try {
      const res = await fetch('/api/scrape/preview', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ url }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'scrape failed')
      setProduct(data.product)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'scrape failed')
    } finally {
      setLoading(false)
    }
  }

  return { product, loading, error, scrape }
}
