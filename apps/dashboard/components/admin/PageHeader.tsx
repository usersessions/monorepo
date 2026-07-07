import Link from 'next/link'
import ExportButton from './ExportButton'
import RefreshButton from './RefreshButton'

// Standard admin page header: serif title left, actions right (custom children,
// refresh, optional export, settings gear).
export default function PageHeader({
  title,
  exportDataset,
  children,
}: {
  title: string
  exportDataset?: string
  children?: React.ReactNode
}) {
  return (
    <div className="flex" style={{ justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--space-md)' }}>
      <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.75rem' }}>{title}</h1>
      <div className="flex" style={{ alignItems: 'center', gap: 'var(--space-sm)', flexWrap: 'wrap' }}>
        {children}
        <RefreshButton />
        {exportDataset ? <ExportButton dataset={exportDataset} /> : null}
        <Link href="/admin/settings" className="btn-ghost" aria-label="Admin settings" style={{ textDecoration: 'none' }}>⚙</Link>
      </div>
    </div>
  )
}
