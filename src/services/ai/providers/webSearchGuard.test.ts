import { describe, it, expect, vi, afterEach } from 'vitest'
import { claudeProvider } from './claude'
import { openaiProvider } from './openai'
import { localProvider } from './local'
import { geminiProvider } from './gemini'
import { AiError, type CompletionRequest } from '../types'

// Gemini now routes through the `ai-proxy` Edge Function (key server-side), so it needs a session.
vi.mock('@/services/supabase/client', () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: { access_token: 'jwt-token' } } }),
    },
  },
}))

const request: CompletionRequest = {
  messages: [{ role: 'user', content: 'hi' }],
  model: 'test-model',
  apiKey: 'k',
  webSearch: true,
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('webSearch guard', () => {
  it('claude throws instead of silently answering from memory', async () => {
    await expect(claudeProvider.complete(request)).rejects.toThrow(AiError)
  })

  it('openai-compatible providers throw', async () => {
    await expect(openaiProvider.complete(request)).rejects.toThrow(AiError)
    await expect(localProvider.complete({ ...request, apiKey: undefined })).rejects.toThrow(AiError)
  })

  it('gemini forwards a grounded request through the proxy (no vendor key in the browser)', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ text: 'report', model: 'test-model' }), { status: 200 }),
    )
    vi.stubGlobal('fetch', fetchMock)

    const result = await geminiProvider.complete(request)
    expect(result.text).toBe('report')

    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toContain('/functions/v1/ai-proxy')
    // The vendor key never travels from the client — only the Supabase JWT.
    expect(init.headers.authorization).toBe('Bearer jwt-token')
    expect(JSON.stringify(init.headers)).not.toContain('x-goog-api-key')
    const body = JSON.parse(init.body)
    expect(body.providerId).toBe('gemini')
    expect(body.webSearch).toBe(true)
  })

  it('gemini forwards an ungrounded request too', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ text: 'ok', model: 'test-model' }), { status: 200 }),
    )
    vi.stubGlobal('fetch', fetchMock)

    await geminiProvider.complete({ ...request, webSearch: undefined })
    const body = JSON.parse(fetchMock.mock.calls[0][1].body)
    expect(body.providerId).toBe('gemini')
    expect(body.webSearch).toBeUndefined()
  })
})
