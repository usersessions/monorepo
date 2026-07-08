import Link from 'next/link'

export interface SwitcherProduct {
  id: string
  name: string
}

/**
 * GAP 25 — product switcher at the top of the sidebar. One product renders as a
 * static card; several render as a disclosure. Always shows slot usage and an
 * "Add another" CTA while slots remain.
 */
export function ProductSwitcher({
  products,
  slotsTotal,
}: {
  products: SwitcherProduct[]
  slotsTotal: number | null
}) {
  if (products.length === 0) return null
  const [first, ...rest] = products
  const ellipsis = { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } as const

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-xs)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--rounded-sm)',
        padding: 'var(--space-sm)',
      }}
    >
      {rest.length === 0 ? (
        <span className="font-sans-label" style={{ color: 'var(--paper)', ...ellipsis }}>
          {first.name}
        </span>
      ) : (
        <details>
          <summary className="font-sans-label" style={{ color: 'var(--paper)', cursor: 'pointer', listStyle: 'none', ...ellipsis }}>
            {first.name} <span className="font-mono-micro">▾ {products.length}</span>
          </summary>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-xs)', marginTop: 'var(--space-xs)' }}>
            {rest.map((p) => (
              <span key={p.id} className="font-mono-micro" style={ellipsis}>
                {p.name}
              </span>
            ))}
          </div>
        </details>
      )}
      <span className="font-mono-micro" style={{ opacity: 0.6 }}>
        {products.length}/{slotsTotal ?? '∞'} product slots
      </span>
      {(slotsTotal === null || products.length < slotsTotal) && (
        <Link href="/onboarding" className="font-mono-micro" style={{ color: 'var(--primary)', textDecoration: 'none' }}>
          + Add another product
        </Link>
      )}
    </div>
  )
}
