import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import crypto from 'crypto'

// --------------------------------------------------------------------------
// Unit tests for apps/dashboard/lib/billing/paystack.ts
// --------------------------------------------------------------------------

// We use dynamic import so that process.env is already set by vitest.setup.ts
// before the module is evaluated.
const { planCode, planIdFromCode, verifyWebhookSignature, initializeTransaction } = await import('./paystack')

const SECRET = 'sk_test_placeholder'

// --------------------------------------------------------------------------
// planCode()
// --------------------------------------------------------------------------
describe('planCode()', () => {
  it('returns the env var value for a known plan key', () => {
    expect(planCode('founder_monthly')).toBe('PLN_founder_monthly')
    expect(planCode('founder_annual')).toBe('PLN_founder_annual')
    expect(planCode('agency_monthly')).toBe('PLN_agency_monthly')
  })

  it('returns null when the env var is unset', () => {
    const original = process.env.PAYSTACK_PLAN_FOUNDER_MONTHLY
    delete process.env.PAYSTACK_PLAN_FOUNDER_MONTHLY
    expect(planCode('founder_monthly')).toBeNull()
    process.env.PAYSTACK_PLAN_FOUNDER_MONTHLY = original
  })
})

// --------------------------------------------------------------------------
// planIdFromCode()
// --------------------------------------------------------------------------
describe('planIdFromCode()', () => {
  it('resolves founder_monthly → "founder"', () => {
    expect(planIdFromCode('PLN_founder_monthly')).toBe('founder')
  })

  it('resolves founder_annual → "founder"', () => {
    expect(planIdFromCode('PLN_founder_annual')).toBe('founder')
  })

  it('resolves agency_monthly → "agency"', () => {
    expect(planIdFromCode('PLN_agency_monthly')).toBe('agency')
  })

  it('returns null for an unknown plan code', () => {
    expect(planIdFromCode('PLN_unknown')).toBeNull()
  })

  it('returns null for null/undefined input', () => {
    expect(planIdFromCode(null)).toBeNull()
    expect(planIdFromCode(undefined)).toBeNull()
  })
})

// --------------------------------------------------------------------------
// verifyWebhookSignature()
// --------------------------------------------------------------------------
describe('verifyWebhookSignature()', () => {
  function sign(body: string, secret = SECRET): string {
    return crypto.createHmac('sha512', secret).update(body).digest('hex')
  }

  it('returns true for a valid signature', () => {
    const body = JSON.stringify({ event: 'charge.success' })
    const sig = sign(body)
    expect(verifyWebhookSignature(body, sig)).toBe(true)
  })

  it('returns false for a tampered body', () => {
    const body = JSON.stringify({ event: 'charge.success' })
    const sig = sign(body)
    const tamperedBody = JSON.stringify({ event: 'charge.failed' })
    expect(verifyWebhookSignature(tamperedBody, sig)).toBe(false)
  })

  it('returns false for a tampered signature', () => {
    const body = JSON.stringify({ event: 'charge.success' })
    expect(verifyWebhookSignature(body, 'deadbeef')).toBe(false)
  })

  it('returns false when signature is null', () => {
    const body = JSON.stringify({ event: 'charge.success' })
    expect(verifyWebhookSignature(body, null)).toBe(false)
  })

  it('returns false when PAYSTACK_SECRET_KEY is missing', () => {
    const original = process.env.PAYSTACK_SECRET_KEY
    delete process.env.PAYSTACK_SECRET_KEY
    const body = JSON.stringify({ event: 'charge.success' })
    const sig = sign(body)
    expect(verifyWebhookSignature(body, sig)).toBe(false)
    process.env.PAYSTACK_SECRET_KEY = original
  })
})

// --------------------------------------------------------------------------
// initializeTransaction() — network call mocked
// --------------------------------------------------------------------------
describe('initializeTransaction()', () => {

  it('returns the authorization URL on success', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: { authorization_url: 'https://paystack.com/pay/abc123' } }),
    })
    vi.stubGlobal('fetch', mockFetch)

    const result = await initializeTransaction({
      email: 'founder@example.com',
      planCode: 'PLN_founder_monthly',
      userId: 'user-uuid-123',
      callbackUrl: 'https://usersessions.io/?billing=success',
    })

    expect(result).toEqual({ authorizationUrl: 'https://paystack.com/pay/abc123' })
    expect(mockFetch).toHaveBeenCalledOnce()
    vi.unstubAllGlobals()
  })

  it('returns null when PAYSTACK_SECRET_KEY is missing', async () => {
    const original = process.env.PAYSTACK_SECRET_KEY
    delete process.env.PAYSTACK_SECRET_KEY
    const result = await initializeTransaction({
      email: 'founder@example.com',
      planCode: 'PLN_founder_monthly',
      userId: 'user-uuid-123',
      callbackUrl: 'https://usersessions.io/?billing=success',
    })
    expect(result).toBeNull()
    process.env.PAYSTACK_SECRET_KEY = original
  })

  it('returns null when Paystack API responds with a non-OK status', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }))
    const result = await initializeTransaction({
      email: 'founder@example.com',
      planCode: 'PLN_founder_monthly',
      userId: 'user-uuid-123',
      callbackUrl: 'https://usersessions.io/?billing=success',
    })
    expect(result).toBeNull()
    vi.unstubAllGlobals()
  })
})
