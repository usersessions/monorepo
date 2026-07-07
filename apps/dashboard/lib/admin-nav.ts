// Single source of truth for admin navigation (sidebar drawer + mobile bottom bar).
export const ADMIN_NAV = [
  { label: 'System', href: '/admin' },
  { label: 'Users', href: '/admin/users' },
  { label: 'Billing', href: '/admin/billing' },
  { label: 'Support', href: '/admin/support' },
  { label: 'Adapters', href: '/admin/adapters' },
  { label: 'Data quality', href: '/admin/data-quality' },
  { label: 'Flags', href: '/admin/flags' },
  { label: 'Compliance', href: '/admin/compliance' },
  { label: 'Audit log', href: '/admin/audit' },
  { label: 'Settings', href: '/admin/settings' },
  { label: 'Dogfood campaign', href: '/admin/dogfood' },
] as const
