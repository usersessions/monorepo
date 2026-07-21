export const dynamic = 'force-dynamic'

/** TODO(pivot): list scraped products once the `products` pivot table lands. */
export default function ProductsPage() {
  return (
    <div className="flex flex-col" style={{ gap: 'var(--space-lg)' }}>
      <header>
        <h1>Products</h1>
        <p style={{ color: 'var(--muted)' }}>Product pages you have scraped for video generation.</p>
      </header>
      <p style={{ color: 'var(--muted)' }}>Nothing here yet — scrape a product from the Generate page.</p>
    </div>
  )
}
