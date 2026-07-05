import type { Metadata } from 'next'
import { AuthPage } from '@/components/AuthPage'

export const metadata: Metadata = { title: 'Sign in — usersessions' }

// Auth screens are session-dependent; never statically prerender them.
export const dynamic = 'force-dynamic'

export default function LoginPage() {
  return <AuthPage initialMode="signin" />
}
