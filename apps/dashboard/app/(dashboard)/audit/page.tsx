import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { AuditCategory, LandingPageAuditResult } from '@usersessions/shared'
import { AuditRunner } from './AuditRunner'
import { ExtensionActionButton } from '@/components/ExtensionActionButton'

/**
 * AIO Audit (Feature A): how well AI assistants can understand and recommend a
 * product's landing page. Honest empty states — no fabricated scores.
 */
export default async function AuditPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: products, error: productsError } = await supabase
    .from('products')
    .select('id, name, url')
    .order('name')
    .limit(1)
  if (productsError) throw new Error(`Failed to load products (${productsError.message})`)

  const product = (products ?? [])[0]

  let latest: LandingPageAuditResult | null = null
  if (product) {
    const { data: row } = await supabase
      .from('landing_page_audits')
      .select('product_id, url, overall_score, categories, top_priority, created_at')
      .eq('product_id', product.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (row) {
      latest = {
        productId: row.product_id,
        url: row.url,
        overallScore: row.overall_score,
        categories: (row.categories as AuditCategory[]) ?? [],
        topPriority: row.top_priority ?? '',
        auditedAt: row.created_at,
      }
    }
  }

  return (
    <div className="flex flex-col" style={{ gap: 'var(--space-lg)', maxWidth: 760 }}>
      <header className="flex flex-col" style={{ gap: 'var(--space-xs)' }}>
        <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.75rem' }}>AI Optimization Audit</h1>
        <p className="font-sans-body">
          How clearly AI assistants can understand and recommend your product from its landing page.
          Every score is computed from your live page — never estimated.
        </p>
      </header>

      {!product ? (
        <div className="card">
          <p className="font-sans-body">
            Add a product first — analyze your landing page in the extension, then run a launch. Your
            AIO audit appears here once a product exists.
          </p>
        </div>
      ) : !product.url ? (
        <div className="card">
          <p className="font-sans-body">This product has no landing-page URL yet, so there is nothing to audit.</p>
        </div>
      ) : (
        <>
          <AuditRunner productId={product.id} url={product.url} initialAudit={latest} />
          <div className="card card--dense flex flex-col" style={{ gap: 'var(--space-xs)' }}>
            <p className="font-mono-label">Refresh your hero image</p>
            <p className="font-mono-micro">
              Updated your landing page? Recapture it for your listings. Best-effort — open the
              extension on your product’s page for reliable capture.
            </p>
            <ExtensionActionButton action="capture" label="Capture page" />
          </div>
        </>
      )}
    </div>
  )
}
