import { describe, it, expect, vi, beforeEach } from 'vitest'
import crypto from 'crypto'

// ============================================================================
// NEW unit tests — pre-launch verification (Step 3)
// Three suites covering:
//  (a) /api/campaigns metering (reverse trial + lifetimeLaunchCap + simulated bypass)
//  (b) webhook subscription.create disables a PREVIOUS different subscription_code
//  (c) cropDataUrl returns input unchanged on invalid image data
// ============================================================================

// ------------------------------------------------------------------ helpers
const SECRET = 'sk_test_placeholder'
function sign(body: string) {
  return crypto.createHmac('sha512', SECRET).update(body).digest('hex')
}

// =====================================================================
// Shared Supabase mock (used by both suites a and b)
// =====================================================================
const mockUpdate = vi.fn()
const mockEq = vi.fn()
const mockInsert = vi.fn().mockResolvedValue({ error: null })
const mockMaybeSingle = vi.fn()
const mockSingle = vi.fn()
const mockSelect = vi.fn()
const mockNeq = vi.fn()
const mockGte = vi.fn()
const mockLimit = vi.fn()
const mockUpsert = vi.fn().mockResolvedValue({ error: null })
const mockIn = vi.fn()

vi.mock('@/lib/supabase/server', () => ({
  createServiceClient: () => mockDb,
  createClient: vi.fn(),
}))

vi.mock('@/lib/billing/paystack', async () => {
  const actual = await vi.importActual<typeof import('@/lib/billing/paystack')>('@/lib/billing/paystack')
  return {
    ...actual,
    verifyWebhookSignature: vi.fn().mockReturnValue(true),
    disableSubscription: vi.fn().mockResolvedValue(true),
    planIdFromCode: vi.fn().mockReturnValue('founder'),
  }
})

vi.mock('@/lib/auth/bearer', () => ({
  authenticateBearer: vi.fn(),
}))

vi.mock('@/lib/rate-limit', () => ({
  rateLimit: vi.fn().mockReturnValue(true),
}))

vi.mock('@/lib/distribution-score', () => ({
  computeDistributionScore: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/lib/flags', () => ({
  isEnabled: vi.fn().mockResolvedValue(false),
}))

// The mockDb object — individual tests configure the chain
const mockDb: any = { from: vi.fn() }

import { authenticateBearer } from '@/lib/auth/bearer'
import { disableSubscription } from '@/lib/billing/paystack'
const { POST: campaignsPOST } = await import('@/app/api/campaigns/route')
const { POST: webhookPOST } = await import('@/app/api/billing/webhook/route')

// =====================================================================
// (a) /api/campaigns — reverse trial metering
// =====================================================================

const PRODUCT_UUID = '00000000-0000-0000-0000-000000000001'
const CAMPAIGN_UUID = '00000000-0000-0000-0000-000000000002'

function makeCampaignReq(results: object[]) {
  const payload = {
    campaignId: CAMPAIGN_UUID,
    productId: PRODUCT_UUID,
    productName: 'Test Product',
    productUrl: 'https://example.com',
    startedAt: new Date().toISOString(),
    finishedAt: new Date().toISOString(),
    results,
  }
  return new Request('https://usersessions.io/api/campaigns', {
    method: 'POST',
    body: JSON.stringify(payload),
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer tok' },
  })
}

function setupCampaignsDb(opts: { signupDaysAgo: number; liveCampaigns: number }) {
  const createdAt = new Date(Date.now() - opts.signupDaysAgo * 86_400_000).toISOString()
  vi.mocked(authenticateBearer).mockResolvedValue({ id: 'user-123', email: 'test@example.com', created_at: createdAt } as any)

  const liveSubs = Array.from({ length: opts.liveCampaigns }, (_, i) => ({ campaign_id: `camp-${i}` }))

  mockDb.from.mockImplementation((table: string) => {
    if (table === 'products') {
      // First call: maybeSingle for ownership — product already exists
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({ data: { id: PRODUCT_UUID, user_id: 'user-123' } }),
          }),
        }),
      }
    }
    if (table === 'profiles') {
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: { plan: 'free' }, error: null }),
          }),
        }),
      }
    }
    if (table === 'submissions') {
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              neq: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue({ data: liveSubs }),
              }),
            }),
          }),
        }),
        insert: vi.fn().mockResolvedValue({ error: null }),
      }
    }
    if (table === 'campaigns') {
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            gte: vi.fn().mockResolvedValue({ count: 0 }),
          }),
        }),
        upsert: vi.fn().mockResolvedValue({ error: null }),
      }
    }
    return {
      insert: vi.fn().mockResolvedValue({ error: null }),
      upsert: vi.fn().mockResolvedValue({ error: null }),
      update: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ eq: vi.fn() }) }),
    }
  })
}

describe('/api/campaigns — reverse trial metering (free plan)', () => {
  beforeEach(() => vi.clearAllMocks())

  it('allows a live launch within the 30-day trial window (0 previous launches)', async () => {
    setupCampaignsDb({ signupDaysAgo: 10, liveCampaigns: 0 })
    const req = makeCampaignReq([{ platformId: 'producthunt', status: 'submitted', simulated: false }])
    const res = await campaignsPOST(req)
    expect(res.status).not.toBe(403)
  })

  it('rejects a SECOND live launch (lifetimeLaunchCap=1) even within trial window', async () => {
    setupCampaignsDb({ signupDaysAgo: 10, liveCampaigns: 1 })
    const req = makeCampaignReq([{ platformId: 'producthunt', status: 'submitted', simulated: false }])
    const res = await campaignsPOST(req)
    expect(res.status).toBe(403)
    expect((await res.json()).error).toBe('PLAN_LIMIT_EXCEEDED')
  })

  it('rejects a live launch >30 days after signup (trial expired)', async () => {
    setupCampaignsDb({ signupDaysAgo: 35, liveCampaigns: 0 })
    const req = makeCampaignReq([{ platformId: 'producthunt', status: 'submitted', simulated: false }])
    const res = await campaignsPOST(req)
    expect(res.status).toBe(403)
    expect((await res.json()).error).toBe('PLAN_LIMIT_EXCEEDED')
  })

  it('always allows SIMULATED runs regardless of trial expiry or launch count', async () => {
    setupCampaignsDb({ signupDaysAgo: 60, liveCampaigns: 5 })
    const req = makeCampaignReq([{ platformId: 'producthunt', status: 'submitted', simulated: true }])
    const res = await campaignsPOST(req)
    expect(res.status).not.toBe(403)
  })
})

// =====================================================================
// (b) webhook subscription.create — disables PREVIOUS subscription_code
// =====================================================================

function makeWebhookReq(body: object): Request {
  const raw = JSON.stringify(body)
  return new Request('https://usersessions.io/api/billing/webhook', {
    method: 'POST',
    body: raw,
    headers: { 'Content-Type': 'application/json', 'x-paystack-signature': sign(raw) },
  })
}

function setupWebhookDb(prevSubCode: string | null) {
  const prevData = prevSubCode
    ? { paystack_subscription_code: prevSubCode, paystack_email_token: 'OLD_TOK' }
    : null

  mockDb.from.mockImplementation((table: string) => {
    if (table === 'profiles') {
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({ data: prevData }),
            // For subscription.disable profile lookup by code:
            single: vi.fn().mockResolvedValue({ data: prevData }),
          }),
        }),
        update: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ eq: vi.fn() }) }),
      }
    }
    return { insert: vi.fn().mockResolvedValue({ error: null }) }
  })
}

describe('POST /api/billing/webhook — subscription.create disables previous sub', () => {
  beforeEach(() => vi.clearAllMocks())

  it('calls disableSubscription with the OLD code when new code differs', async () => {
    setupWebhookDb('SUB_OLD')
    const body = {
      event: 'subscription.create',
      data: {
        metadata: { user_id: 'user-uuid-123' },
        customer: { customer_code: 'CUS_abc' },
        plan: { plan_code: 'PLN_pro_monthly' },
        subscription_code: 'SUB_NEW',
        email_token: 'NEW_TOK',
      },
    }
    const res = await webhookPOST(makeWebhookReq(body))
    expect(res.status).toBe(200)
    expect(disableSubscription).toHaveBeenCalledWith('SUB_OLD', 'OLD_TOK')
  })

  it('does NOT call disableSubscription when subscription_code is the same', async () => {
    setupWebhookDb('SUB_SAME')
    const body = {
      event: 'subscription.create',
      data: {
        metadata: { user_id: 'user-uuid-123' },
        customer: { customer_code: 'CUS_abc' },
        plan: { plan_code: 'PLN_founder_monthly' },
        subscription_code: 'SUB_SAME',
        email_token: 'TOK',
      },
    }
    const res = await webhookPOST(makeWebhookReq(body))
    expect(res.status).toBe(200)
    expect(disableSubscription).not.toHaveBeenCalled()
  })

  it('does NOT call disableSubscription when there is no previous subscription', async () => {
    setupWebhookDb(null)
    const body = {
      event: 'subscription.create',
      data: {
        metadata: { user_id: 'user-uuid-123' },
        customer: { customer_code: 'CUS_new' },
        plan: { plan_code: 'PLN_founder_annual' },
        subscription_code: 'SUB_FIRST',
        email_token: 'TOK_FIRST',
      },
    }
    const res = await webhookPOST(makeWebhookReq(body))
    expect(res.status).toBe(200)
    expect(disableSubscription).not.toHaveBeenCalled()
  })
})

// =====================================================================
// (c) cropDataUrl — returns input unchanged on invalid image data
// =====================================================================

// cropDataUrl is an internal function in background.ts (Chrome SW, not importable in jsdom).
// We replicate the exact algorithm as a pure function and test the fallback contract.

async function cropDataUrl(dataUrl: string, ratio: number): Promise<string> {
  try {
    const blob = await (await fetch(dataUrl)).blob()
    const bmp = await createImageBitmap(blob)
    let w = bmp.width; let h = bmp.height
    if (w / h > ratio) w = Math.round(h * ratio); else h = Math.round(w / ratio)
    const canvas = new (globalThis as any).OffscreenCanvas(w, h)
    const ctx = canvas.getContext('2d')
    if (!ctx) return dataUrl
    ctx.drawImage(bmp, Math.round((bmp.width - w) / 2), 0, w, h, 0, 0, w, h)
    const out = await canvas.convertToBlob({ type: 'image/png' })
    const buf = new Uint8Array(await out.arrayBuffer())
    let bin = ''
    for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000))
    return `data:image/png;base64,${btoa(bin)}`
  } catch {
    return dataUrl  // crop is best-effort; the raw shot still works
  }
}

describe('cropDataUrl contract — returns input unchanged on invalid data', () => {
  beforeEach(() => vi.unstubAllGlobals())

  it('returns the original dataUrl when fetch rejects (network error)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('fetch failed')))
    const bad = 'data:image/png;base64,INVALID'
    expect(await cropDataUrl(bad, 16 / 9)).toBe(bad)
  })

  it('returns the original dataUrl when createImageBitmap rejects', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ blob: async () => new Blob(['x'], { type: 'image/png' }) }))
    vi.stubGlobal('createImageBitmap', vi.fn().mockRejectedValue(new Error('Not supported')))
    const bad = 'data:image/png;base64,ABC'
    expect(await cropDataUrl(bad, 1)).toBe(bad)
  })

  it('returns the original dataUrl when OffscreenCanvas is unavailable', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ blob: async () => new Blob(['x'], { type: 'image/png' }) }))
    vi.stubGlobal('createImageBitmap', vi.fn().mockResolvedValue({ width: 100, height: 100 }))
    // OffscreenCanvas not set → new (globalThis as any).OffscreenCanvas throws
    const bad = 'data:image/png;base64,XYZ'
    expect(await cropDataUrl(bad, 16 / 9)).toBe(bad)
  })
})
