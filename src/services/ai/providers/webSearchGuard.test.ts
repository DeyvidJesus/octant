import { describe, it, expect, vi, afterEach } from 'vitest'
import { claudeProvider } from './claude'
import { openaiProvider } from './openai'
import { localProvider } from './local'
import { geminiProvider } from './gemini'
import { AiError, type CompletionRequest } from '../types'

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

  it('gemini adds the google_search tool to the request body', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ candidates: [{ content: { parts: [{ text: 'report' }] } }] }),
        { status: 200 },
      ),
    )
    vi.stubGlobal('fetch', fetchMock)

    const result = await geminiProvider.complete(request)
    expect(result.text).toBe('report')

    const body = JSON.parse(fetchMock.mock.calls[0][1].body)
    expect(body.tools).toEqual([{ google_search: {} }])
  })

  it('gemini omits tools when webSearch is not requested', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ candidates: [{ content: { parts: [{ text: 'ok' }] } }] }),
        { status: 200 },
      ),
    )
    vi.stubGlobal('fetch', fetchMock)

    await geminiProvider.complete({ ...request, webSearch: undefined })
    const body = JSON.parse(fetchMock.mock.calls[0][1].body)
    expect(body.tools).toBeUndefined()
  })
})
