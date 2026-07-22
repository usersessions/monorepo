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
      <div className="flex gap-2">
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://your-product-page.com"
          className="flex-1 p-2 rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
        />
        <button 
          onClick={() => scrape.scrape(url)} 
          disabled={scrape.loading || !url}
          className="py-2 px-4 bg-primary text-primary-foreground rounded-md disabled:opacity-50"
        >
          {scrape.loading ? 'Scraping…' : 'Preview'}
        </button>
      </div>
      {scrape.error && <p style={{ color: 'var(--red)' }}>{scrape.error}</p>}

      {scrape.product && (
        <>
          <ProductPreview product={scrape.product} />
          <button 
            onClick={() => gen.suggestPrompt(scrape.product!)} 
            disabled={gen.busy}
            className="w-full py-2 px-4 bg-secondary text-secondary-foreground rounded-md disabled:opacity-50 border border-border hover:bg-secondary/80"
          >
            {gen.busy ? 'Thinking…' : 'Suggest prompt with AI'}
          </button>
          <textarea
            value={gen.prompt}
            onChange={(e) => gen.setPrompt(e.target.value)}
            rows={5}
            placeholder="Describe the video you want…"
            className="w-full p-3 rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-500"
          />
          <button
            onClick={() => gen.generate(scrape.product!.title, scrape.product!.url)}
            disabled={gen.busy || !gen.prompt}
            className="w-full py-2 px-4 bg-primary text-primary-foreground rounded-md disabled:opacity-50"
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
