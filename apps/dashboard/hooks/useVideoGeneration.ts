'use client'

import { useState } from 'react'
import type { Video } from '@/types/video'
import type { ScrapedProduct } from '@/types/product'

export function useVideoGeneration() {
  const [video, setVideo] = useState<Video | null>(null)
  const [prompt, setPrompt] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function suggestPrompt(product: ScrapedProduct) {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/ai/prompt', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ product }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'prompt generation failed')
      setPrompt(data.prompt)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'prompt generation failed')
    } finally {
      setBusy(false)
    }
  }

  async function generate(title: string, productUrl?: string) {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/videos', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ title, prompt, productUrl }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'generation failed')
      setVideo(data.video)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'generation failed')
    } finally {
      setBusy(false)
    }
  }

  return { video, prompt, setPrompt, busy, error, suggestPrompt, generate }
}
