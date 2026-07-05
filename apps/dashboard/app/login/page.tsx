'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const supabase = createClient()
  const redirectTo = () => `${window.location.origin}/auth/callback`

  useEffect(() => {
    const err = new URLSearchParams(window.location.search).get('error')
    if (err === 'google_admin_only')
      setError('Google sign-in is reserved for the admin account. Use your email magic link instead.')
    else if (err === 'auth') setError('Sign-in failed — request a fresh link and try again.')
  }, [])

  async function sendMagicLink(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: redirectTo() },
    })
    setBusy(false)
    if (error) setError(error.message)
    else setSent(true)
  }

  async function signInWithGoogle() {
    setError(null)
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: redirectTo() },
    })
    if (error) setError(error.message)
  }

  return (
    <main className="min-h-screen flex items-center justify-center" style={{ padding: 'var(--space-lg)' }}>
      <div className="card w-full" style={{ maxWidth: 400, display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
        <span className="italic text-center" style={{ fontFamily: 'var(--font-serif)', fontSize: '1.5rem' }}>
          usersessions
        </span>

        {sent ? (
          <p className="font-sans-body text-center">
            Check your inbox — your sign-in link is on its way to{' '}
            <span className="font-mono-data" style={{ color: 'var(--paper)' }}>{email}</span>.
          </p>
        ) : (
          <form onSubmit={sendMagicLink} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
            <input
              className="input-field"
              type="email"
              required
              placeholder="you@yourproduct.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <button className="btn-primary" type="submit" disabled={busy}>
              {busy ? 'Sending…' : 'Send magic link'}
            </button>
          </form>
        )}

        <div className="flex items-center" style={{ gap: 'var(--space-sm)' }}>
          <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
          <span className="font-mono-micro">or</span>
          <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
        </div>

        <button className="btn-ghost" onClick={signInWithGoogle}>
          Admin · Continue with Google
        </button>

        {error && (
          <p className="font-mono-micro" style={{ color: 'var(--red)' }}>{error}</p>
        )}

        <p className="font-mono-micro text-center">
          No account? It&apos;s the same link — just enter your email.
        </p>
      </div>
    </main>
  )
}
