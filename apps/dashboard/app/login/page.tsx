import type { Metadata } from 'next'
import { AuthPage } from '@/components/AuthPage'

export const metadata: Metadata = { title: 'Sign in — usersessions' }

export default function LoginPage() {
  return <AuthPage initialMode="signin" />
}
