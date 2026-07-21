'use client'

import type { ScrapedProduct } from '@/types/product'

export function ProductPreview({ product }: { product: ScrapedProduct }) {
  return (
    <div className="card" style={{ padding: 'var(--space-md)', display: 'flex', gap: 'var(--space-md)' }}>
      {product.image_url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={product.image_url} alt="" style={{ width: 96, height: 96, objectFit: 'cover', borderRadius: 4 }} />
      )}
      <div>
        <p style={{ fontWeight: 600 }}>{product.title}</p>
        {product.description && <p style={{ color: 'var(--muted)', fontSize: '0.875rem' }}>{product.description}</p>}
        <p className="font-mono-micro" style={{ color: 'var(--muted-2)' }}>{product.site_name ?? product.url}</p>
      </div>
    </div>
  )
}
