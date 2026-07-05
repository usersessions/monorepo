'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

type Mode = 'signin' | 'signup'

const VALUE_PROPS = [
  {
    label: '01 / Distribute',
    copy: 'Get listed on every AI index and launch platform that matters — from one dashboard, in minutes.',
  },
  {
    label: '02 / Monitor',
    copy: 'Automated link checks and platform quality scores keep every listing alive and accurate.',
  },
  {
    label: '03 / Measure',
    copy: 'See whether AI assistants actually recommend your product, and watch visibility trend week over week.',
  },
]

const linkButtonStyle: React.CSSProperties = {
  background: 'none',
  border: 'none',
  padding: 0,
  font: 'inherit',
  color: 'var(--paper)',
  textDecoration: 'underline',
  cursor: 'pointer',
}

export function AuthPage({ initialMode }: { initialMode: Mode }) {
  const [mode, setMode] = useState<Mode>(initialMode)
  const [email, setEmail] = useState('')
  const [fullName, setFullName] = useState('')
  const [sent, setSent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [cooldown, setCooldown] = useState(0)

  useEffect(() => {
    const err = new URLSearchParams(window.location.search).get('error')
    if (err === 'auth') setError('Sign-in failed — request a fresh link and try again.')
  }, [])

  useEffect(() => {
    if (cooldown <= 0) return
    const t = setTimeout(() => setCooldown((s) => s - 1), 1000)
    return () => clearTimeout(t)
  }, [cooldown])

  async function sendMagicLink(e?: React.FormEvent) {
    e?.preventDefault()
    setBusy(true)
    setError(null)
    // Created lazily in the handler: never runs during prerender, where
    // NEXT_PUBLIC_SUPABASE_* env vars may be absent (e.g. CI builds).
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
        data: mode === 'signup' && fullName.trim() ? { full_name: fullName.trim() } : undefined,
      },
    })
    setBusy(false)
    if (error) setError(error.message)
    else {
      setSent(true)
      setCooldown(30)
    }
  }

  async function signInWithGoogle() {
    setError(null)
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    })
    if (error) setError(error.message)
  }

  function switchMode(next: Mode) {
    setMode(next)
    setSent(false)
    setError(null)
  }

  return (
    <main className="min-h-screen grid lg:grid-cols-2">
      {/* Brand panel — hidden on small screens */}
      <section
        className="hidden lg:flex flex-col justify-between"
        style={{
          background: 'var(--ink-2)',
          borderRight: '1px solid var(--border)',
          padding: 'var(--space-2xl)',
        }}
      >
        <span className="italic" style={{ fontFamily: 'var(--font-serif)', fontSize: '1.5rem' }}>
          usersessions
        </span>

        <div className="flex flex-col" style={{ gap: 'var(--space-2xl)', maxWidth: 480 }}>
          <h1
            className="italic"
            style={{ fontFamily: 'var(--font-serif)', fontSize: '2.75rem', lineHeight: 1.1, fontWeight: 400 }}
          >
            Get your product found everywhere software gets discovered.
          </h1>

          <div className="flex flex-col" style={{ gap: 'var(--space-lg)' }}>
            {VALUE_PROPS.map((v) => (
              <div key={v.label}>
                <p className="font-mono-label" style={{ marginBottom: 'var(--space-xs)' }}>
                  {v.label}
                </p>
                <p className="font-sans-body">{v.copy}</p>
              </div>
            ))}
          </div>
        </div>

        <p className="font-mono-micro">The distribution engine for founders · usersessions.io</p>
      </section>

      {/* Auth panel */}
      <section className="flex items-center justify-center" style={{ padding: 'var(--space-lg)' }}>
        <div className="w-full flex flex-col" style={{ maxWidth: 420, gap: 'var(--space-lg)' }}>
          <span
            className="italic text-center lg:hidden"
            style={{ fontFamily: 'var(--font-serif)', fontSize: '1.5rem' }}
          >
            usersessions
          </span>

          <div className="card flex flex-col" style={{ gap: 'var(--space-md)' }}>
            <div className="tab-switch" role="tablist" aria-label="Authentication mode">
              <button
                type="button"
                role="tab"
                aria-selected={mode === 'signin'}
                className={mode === 'signin' ? 'is-active' : ''}
                onClick={() => switchMode('signin')}
              >
                Sign in
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={mode === 'signup'}
                className={mode === 'signup' ? 'is-active' : ''}
                onClick={() => switchMode('signup')}
              >
                Create account
              </button>
            </div>

            <div>
              <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.5rem' }}>
                {mode === 'signin' ? 'Welcome back' : 'Start distributing'}
              </h2>
              <p className="font-sans-body">
                {mode === 'signin'
                  ? 'Enter your email and we will send you a one-time sign-in link. No password to remember.'
                  : 'Create your account with just an email. Your first campaign is free — no credit card required.'}
              </p>
            </div>

            {sent ? (
              <div className="flex flex-col" style={{ gap: 'var(--space-md)' }}>
                <div className="card card--dense" style={{ background: 'var(--ink)' }}>
                  <p className="font-sans-body">
                    Check your inbox — your {mode === 'signup' ? 'account activation' : 'sign-in'} link is on
                    its way to{' '}
                    <span className="font-mono-data" style={{ color: 'var(--paper)' }}>
                      {email}
                    </span>
                    .
                  </p>
                </div>
                <button
                  className="btn-ghost"
                  type="button"
                  disabled={busy || cooldown > 0}
                  onClick={() => sendMagicLink()}
                >
                  {cooldown > 0 ? `Resend link in ${cooldown}s` : busy ? 'Sending…' : 'Resend link'}
                </button>
                <button
                  className="font-mono-micro"
                  type="button"
                  style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer' }}
                  onClick={() => setSent(false)}
                >
                  Use a different email
                </button>
              </div>
            ) : (
              <form onSubmit={sendMagicLink} className="flex flex-col" style={{ gap: 'var(--space-md)' }}>
                {mode === 'signup' && (
                  <div className="flex flex-col" style={{ gap: 'var(--space-xs)' }}>
                    <label className="font-mono-label" htmlFor="full-name">
                      Full name
                    </label>
                    <input
                      id="full-name"
                      className="input-field"
                      type="text"
                      autoComplete="name"
                      placeholder="Ada Lovelace"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                    />
                  </div>
                )}
                <div className="flex flex-col" style={{ gap: 'var(--space-xs)' }}>
                  <label className="font-mono-label" htmlFor="email">
                    Work email
                  </label>
                  <input
                    id="email"
                    className="input-field"
                    type="email"
                    required
                    autoComplete="email"
                    placeholder="you@yourproduct.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
                <button
                  className="btn-primary"
                  type="submit"
                  disabled={busy}
                  style={{ padding: 'var(--space-md)' }}
                >
                  {busy ? 'Sending…' : mode === 'signin' ? 'Email me a sign-in link' : 'Create my account'}
                </button>
              </form>
            )}

            <div className="flex items-center" style={{ gap: 'var(--space-sm)' }}>
              <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
              <span className="font-mono-micro">or</span>
              <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
            </div>

            <button className="btn-ghost" type="button" onClick={signInWithGoogle}>
              Continue with Google
            </button>

            {error && (
              <p className="font-mono-data" role="alert" style={{ color: 'var(--red)' }}>
                {error}
              </p>
            )}
          </div>

          <p className="font-mono-micro text-center">
            {mode === 'signin' ? (
              <>
                New here?{' '}
                <button type="button" style={linkButtonStyle} onClick={() => switchMode('signup')}>
                  Create an account
                </button>
              </>
            ) : (
              <>
                Already have an account?{' '}
                <button type="button" style={linkButtonStyle} onClick={() => switchMode('signin')}>
                  Sign in
                </button>
              </>
            )}
          </p>
        </div>
      </section>
    </main>
  )
}
