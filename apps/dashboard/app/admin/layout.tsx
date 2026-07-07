import { requireAdmin } from '@/lib/admin'
import AdminBreadcrumbs from '@/components/admin/AdminBreadcrumbs'
import AdminShell from '@/components/admin/AdminShell'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { email } = await requireAdmin() // hard redirect for non-admins, every route

  return (
    <AdminShell email={email}>
      <AdminBreadcrumbs />
      {children}
    </AdminShell>
  )
}
