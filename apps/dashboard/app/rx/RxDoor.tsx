'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

/**
 * Operator door. Unlinked, noindexed. Google OAuth only — the auth callback
 * rejects any non-admin Google account SERVER-SIDE (signed out immediately),
 * so this page is a convenience, never the security boundary.
 */
export function RxDoor() {
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    const err = new URLSearchParams(window.location.search).get('error')
    if (err === 'google_admin_only') setError('That Google account is not the operator account.')
    else if (err === 'auth') setError('Sign-in failed — try again.')
  }, [])

  async function signIn() {
    setBusy(true)
    setError(null)
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback?next=/admin` },
    })
    if (error) {
      setError(error.message)
      setBusy(false)
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center" style={{ padding: 'var(--space-lg)' }}>
      <div className="card w-full flex flex-col" style={{ maxWidth: 360, gap: 'var(--space-md)' }}>
        <span className="italic text-center" style={{ fontFamily: 'var(--font-serif)', fontSize: '1.5rem' }}>
          usersessions
        </span>
        <p className="font-mono-label text-center">Restricted · operator access</p>
        <button className="btn-primary" type="button" onClick={signIn} disabled={busy}>
          {busy ? 'Redirecting…' : 'Continue with Google'}
        </button>
        {error && (
          <p className="font-mono-data" role="alert" style={{ color: 'var(--red)' }}>
            {error}
          </p>
        )}
        <p className="font-mono-micro text-center">Non-operator accounts are rejected server-side.</p>
      </div>
    </main>
  )
}
