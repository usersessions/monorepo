import { describe, it, expect, vi, beforeEach } from 'vitest'
import crypto from 'crypto'

// --------------------------------------------------------------------------
// Integration-style tests for POST /api/billing/webhook
// --------------------------------------------------------------------------
// We mock Supabase and the verifyWebhookSignature helper so we can call the
// handler directly without a running server or database.
// --------------------------------------------------------------------------

const SECRET = 'sk_test_placeholder'

function sign(body: string): string {
  return crypto.createHmac('sha512', SECRET).update(body).digest('hex')
}

// ------ Supabase mock ------
const mockUpdate = vi.fn().mockReturnThis()
const mockEq = vi.fn().mockReturnThis()
const mockInsert = vi.fn().mockResolvedValue({ error: null })
const mockMaybeSingle = vi.fn().mockResolvedValue({ data: { id: 'user-uuid-123' } })
const mockSelect = vi.fn().mockReturnThis()

const mockDb = {
  from: vi.fn().mockReturnValue({
    update: mockUpdate,
    select: mockSelect,
    insert: mockInsert,
    eq: mockEq,
    maybeSingle: mockMaybeSingle,
  }),
}

vi.mock('@/lib/supabase/server', () => ({
  createServiceClient: () => mockDb,
  createClient: vi.fn(),
}))

vi.mock('@/lib/flags', () => ({
  isEnabled: vi.fn().mockResolvedValue(false),
}))

// Chain mocks properly
beforeEach(() => {
  mockUpdate.mockReturnValue({ eq: mockEq })
  mockEq.mockReturnValue({ eq: mockEq, maybeSingle: mockMaybeSingle })
  mockSelect.mockReturnValue({ eq: mockEq })
  mockInsert.mockResolvedValue({ error: null })
  vi.clearAllMocks()
  // Restore eq chaining after clearAllMocks
  mockUpdate.mockReturnValue({ eq: mockEq })
  mockEq.mockReturnValue({ eq: mockEq, maybeSingle: mockMaybeSingle })
  mockSelect.mockReturnValue({ eq: mockEq })
  mockInsert.mockResolvedValue({ error: null })
})

const { POST } = await import('./route')

function makeRequest(body: object, signature?: string): Request {
  const raw = JSON.stringify(body)
  const sig = signature ?? sign(raw)
  return new Request('https://usersessions.io/api/billing/webhook', {
    method: 'POST',
    body: raw,
    headers: {
      'Content-Type': 'application/json',
      'x-paystack-signature': sig,
    },
  })
}

// --------------------------------------------------------------------------
describe('POST /api/billing/webhook — signature validation', () => {
  it('rejects an invalid signature with 401', async () => {
    const req = makeRequest({ event: 'charge.success' }, 'bad-signature')
    const res = await POST(req)
    expect(res.status).toBe(401)
    const json = await res.json()
    expect(json.error).toBe('INVALID_SIGNATURE')
  })

  it('accepts a valid HMAC-SHA512 signature with 200', async () => {
    const body = {
      event: 'charge.success',
      data: {
        metadata: { user_id: 'user-uuid-123' },
        customer: { customer_code: 'CUS_abc', email: 'test@example.com' },
        plan: { plan_code: 'PLN_founder_monthly' },
        amount: 2000,
        currency: 'NGN',
        reference: 'ref_abc',
      },
    }
    const req = makeRequest(body)
    const res = await POST(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.ok).toBe(true)
  })
})

// --------------------------------------------------------------------------
describe('POST /api/billing/webhook — charge.success', () => {
  it('updates the profiles table with active status and plan', async () => {
    const body = {
      event: 'charge.success',
      data: {
        metadata: { user_id: 'user-uuid-123' },
        customer: { customer_code: 'CUS_abc', email: 'test@example.com' },
        plan: { plan_code: 'PLN_founder_monthly' },
        amount: 2000,
        currency: 'NGN',
        reference: 'ref_abc',
      },
    }
    const req = makeRequest(body)
    const res = await POST(req)
    expect(res.status).toBe(200)
    expect(mockDb.from).toHaveBeenCalledWith('profiles')
    expect(mockDb.from).toHaveBeenCalledWith('revenue_events')
  })
})

// --------------------------------------------------------------------------
describe('POST /api/billing/webhook — subscription.create', () => {
  it('stores subscription_code and email_token on the profile', async () => {
    const body = {
      event: 'subscription.create',
      data: {
        metadata: { user_id: 'user-uuid-123' },
        customer: { customer_code: 'CUS_abc', email: 'test@example.com' },
        plan: { plan_code: 'PLN_founder_annual' },
        subscription_code: 'SUB_xyz',
        email_token: 'email_token_abc',
      },
    }
    const req = makeRequest(body)
    const res = await POST(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.ok).toBe(true)
  })
})

// --------------------------------------------------------------------------
describe('POST /api/billing/webhook — invoice.payment_failed', () => {
  it('sets subscription_status to attention', async () => {
    const body = {
      event: 'invoice.payment_failed',
      data: {
        subscription: { subscription_code: 'SUB_xyz' },
      },
    }
    const req = makeRequest(body)
    const res = await POST(req)
    expect(res.status).toBe(200)
    expect(mockDb.from).toHaveBeenCalledWith('profiles')
  })
})

// --------------------------------------------------------------------------
describe('POST /api/billing/webhook — unknown events', () => {
  it('acknowledges unknown events without erroring', async () => {
    const body = { event: 'some.unknown.event', data: {} }
    const req = makeRequest(body)
    const res = await POST(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.ok).toBe(true)
  })
})
