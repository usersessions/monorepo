import type { Metadata } from 'next'
import { AuthPage } from '@/components/AuthPage'

export const metadata: Metadata = { title: 'Create your account — usersessions' }

// Auth screens are session-dependent; never statically prerender them.
export const dynamic = 'force-dynamic'

export default function SignupPage() {
  return <AuthPage initialMode="signup" />
}
