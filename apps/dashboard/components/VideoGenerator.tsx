'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useProductScrape } from '@/hooks/useProductScrape'
import { useVideoGeneration } from '@/hooks/useVideoGeneration'
import { ProductPreview } from '@/components/ProductPreview'
import { GenerationProgress } from '@/components/GenerationProgress'

export function VideoGenerator() {
  const [url, setUrl] = useState('')
  const scrape = useProductScrape()
  const gen = useVideoGeneration()

  return (
    <div className="flex flex-col" style={{ gap: 'var(--space-lg)', maxWidth: 640 }}>
      <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://your-product-page.com"
          style={{ flex: 1, padding: 8 }}
        />
        <button onClick={() => scrape.scrape(url)} disabled={scrape.loading || !url}>
          {scrape.loading ? 'Scraping…' : 'Preview'}
        </button>
      </div>
      {scrape.error && <p style={{ color: 'var(--red)' }}>{scrape.error}</p>}

      {scrape.product && (
        <>
          <ProductPreview product={scrape.product} />
          <button onClick={() => gen.suggestPrompt(scrape.product!)} disabled={gen.busy}>
            {gen.busy ? 'Thinking…' : 'Suggest prompt with AI'}
          </button>
          <textarea
            value={gen.prompt}
            onChange={(e) => gen.setPrompt(e.target.value)}
            rows={5}
            placeholder="Describe the video you want…"
            style={{ padding: 8 }}
          />
          <button
            onClick={() => gen.generate(scrape.product!.title, scrape.product!.url)}
            disabled={gen.busy || !gen.prompt}
          >
            Generate video
          </button>
        </>
      )}
      {gen.error && <p style={{ color: 'var(--red)' }}>{gen.error}</p>}
      {gen.video && (
        <div>
          <GenerationProgress status={gen.video.status} />
          <p>
            Track it in <Link href={`/videos/${gen.video.id}`}>your video library →</Link>
          </p>
        </div>
      )}
    </div>
  )
}
