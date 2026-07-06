import { describe, it, expect, vi, beforeEach } from 'vitest'

// --------------------------------------------------------------------------
// Unit tests for apps/extension/src/brain.ts — generateCopy()
// Tests verify that every backend error code is translated to the correct
// human-readable error message shown in the popup.
// --------------------------------------------------------------------------

// Stub chrome.storage.local so the module can be imported outside of Chrome
vi.stubGlobal('chrome', {
  storage: {
    local: {
      get: vi.fn().mockResolvedValue({ accessToken: 'test-token-abc' }),
    },
  },
})

// Stub process.env for the Plasmo env var
vi.stubGlobal('process', {
  ...process,
  env: {
    ...process.env,
    PLASMO_PUBLIC_DASHBOARD_URL: 'https://usersessions.io',
  },
})

// Use dynamic import so chrome global is stubbed before evaluation
const { generateCopy } = await import('../../apps/extension/src/brain')

// Helper: create a mock fetch response
function mockFetchResponse(status: number, body: object): void {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: status >= 200 && status < 300,
      status,
      json: async () => body,
    })
  )
}

const mockSiteData = {
  url: 'https://example.com',
  title: 'Example App',
  description: 'A great tool',
  tagline: 'Do more with less',
  keywords: ['ai', 'productivity'],
  h1s: ['Welcome to Example'],
}

beforeEach(() => {
  vi.unstubAllGlobals()
  // Re-stub chrome after unstubAll
  vi.stubGlobal('chrome', {
    storage: {
      local: {
        get: vi.fn().mockResolvedValue({ accessToken: 'test-token-abc' }),
      },
    },
  })
})

// --------------------------------------------------------------------------
describe('generateCopy() — success', () => {
  it('returns CopyResponse on a 200 response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          copy: [
            { category: 'ai', hook: 'AI hook text', body: 'AI body text' },
            { category: 'startup', hook: 'Startup hook', body: 'Startup body' },
          ],
        }),
      })
    )

    const result = await generateCopy(mockSiteData)
    expect(result.copy).toHaveLength(2)
    expect(result.copy[0].category).toBe('ai')
  })
})

// --------------------------------------------------------------------------
describe('generateCopy() — error code mapping', () => {
  it('throws "Session expired" on 401', async () => {
    mockFetchResponse(401, { error: 'UNAUTHORIZED' })
    await expect(generateCopy(mockSiteData)).rejects.toThrow('Session expired')
  })

  it('throws a Gemini key message on AI_NOT_CONFIGURED', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 503,
        json: async () => ({ error: 'AI_NOT_CONFIGURED' }),
      })
    )
    await expect(generateCopy(mockSiteData)).rejects.toThrow('AI copy is not configured on the server yet')
  })

  it('throws a server-side key issue message on GENERATION_FAILED', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 502,
        json: async () => ({ error: 'GENERATION_FAILED' }),
      })
    )
    await expect(generateCopy(mockSiteData)).rejects.toThrow('AI provider rejected the request')
  })

  it('throws the generic fallback for any other non-ok response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        json: async () => ({ error: 'INTERNAL_SERVER_ERROR' }),
      })
    )
    await expect(generateCopy(mockSiteData)).rejects.toThrow('Copy generation failed')
  })

  it('throws "Not connected" when no token exists in storage', async () => {
    vi.stubGlobal('chrome', {
      storage: {
        local: {
          get: vi.fn().mockResolvedValue({}), // no accessToken
        },
      },
    })
    await expect(generateCopy(mockSiteData)).rejects.toThrow('Not connected')
  })
})
