import type { Metadata } from 'next'
import { AuthPage } from '@/components/AuthPage'

export const metadata: Metadata = { title: 'Create your account — usersessions' }

export default function SignupPage() {
  return <AuthPage initialMode="signup" />
}
