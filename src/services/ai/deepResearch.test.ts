import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { startDeepResearch, awaitDeepResearch } from './deepResearch'
import { AiError } from './types'

// Deep Research now runs through the `deep-research` Edge Function, authorized with the user's JWT.
// The Gemini key lives server-side, so the client only ever sends { action, prompt|interactionId }.
vi.mock('@/services/supabase/client', () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: { access_token: 'jwt-token' } } }),
    },
  },
}))

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status })
}

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

/** Advances fake timers until the promise settles. */
async function settle<T>(promise: Promise<T>): Promise<T> {
  // Attach a handler immediately so rejections mid-advance aren't "unhandled".
  const guarded = promise.catch((err: unknown) => ({ __settleError: err }))
  await vi.runAllTimersAsync()
  const result = await guarded
  if (result && typeof result === 'object' && '__settleError' in result) {
    throw result.__settleError
  }
  return result as T
}

describe('startDeepResearch', () => {
  it('POSTs the start action to the Edge Function with the user JWT and returns the interaction id', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ id: 'int-1', status: 'queued' }))
    vi.stubGlobal('fetch', fetchMock)

    const { interactionId } = await startDeepResearch('find jobs')
    expect(interactionId).toBe('int-1')

    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toContain('/functions/v1/deep-research')
    expect(init.headers.authorization).toBe('Bearer jwt-token')
    // The Gemini key must NOT travel from the client.
    expect(JSON.stringify(init.headers)).not.toContain('x-goog-api-key')
    const body = JSON.parse(init.body)
    expect(body.action).toBe('start')
    expect(body.prompt).toBe('find jobs')
  })

  it('translates a blocked/offline fetch into a resumable, paste-fallback message', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))
    await expect(startDeepResearch('x')).rejects.toThrow(/paste/i)
  })

  it('throws on a missing id', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ status: 'queued' })))
    await expect(startDeepResearch('x')).rejects.toThrow(AiError)
  })
})

describe('awaitDeepResearch', () => {
  it('polls the Edge Function until completed and returns the last step text', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ id: 'int-1', status: 'in_progress' }))
      .mockResolvedValueOnce(
        jsonResponse({
          id: 'int-1',
          status: 'completed',
          steps: [{ content: [{ type: 'text', text: 'draft' }] }, { content: [{ type: 'text', text: 'FINAL REPORT' }] }],
        }),
      )
    vi.stubGlobal('fetch', fetchMock)

    const report = await settle(awaitDeepResearch('int-1'))
    expect(report).toBe('FINAL REPORT')
    expect(fetchMock).toHaveBeenCalledTimes(2)

    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toContain('/functions/v1/deep-research')
    const body = JSON.parse(init.body)
    expect(body.action).toBe('poll')
    expect(body.interactionId).toBe('int-1')
  })

  it('reports progress between polls', async () => {
    const onProgress = vi.fn()
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ status: 'in_progress' }))
      .mockResolvedValueOnce(jsonResponse({ status: 'completed', steps: [{ content: [{ text: 'r' }] }] }))
    vi.stubGlobal('fetch', fetchMock)

    await settle(awaitDeepResearch('int-1', { onProgress }))
    expect(onProgress).toHaveBeenCalledWith(expect.objectContaining({ status: 'in_progress', polls: 1 }))
  })

  it('throws when the run failed, including the server message', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(() =>
        Promise.resolve(jsonResponse({ status: 'failed', error: { message: 'quota exceeded' } })),
      ),
    )
    await expect(settle(awaitDeepResearch('int-1'))).rejects.toThrow(/quota exceeded/)
  })

  it('tolerates up to 2 consecutive poll failures, throws on the 3rd', async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new TypeError('blip'))
      .mockRejectedValueOnce(new TypeError('blip'))
      .mockResolvedValueOnce(jsonResponse({ status: 'completed', steps: [{ content: [{ text: 'ok' }] }] }))
    vi.stubGlobal('fetch', fetchMock)

    const report = await settle(awaitDeepResearch('int-1'))
    expect(report).toBe('ok')

    const alwaysFailing = vi.fn().mockRejectedValue(new TypeError('down'))
    vi.stubGlobal('fetch', alwaysFailing)
    await expect(settle(awaitDeepResearch('int-2'))).rejects.toThrow(AiError)
    expect(alwaysFailing).toHaveBeenCalledTimes(3)
  })

  it('rejects promptly on abort and keeps the message resumable', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation(() => Promise.resolve(jsonResponse({ status: 'in_progress' }))))
    const controller = new AbortController()

    const promise = awaitDeepResearch('int-1', { signal: controller.signal })
    const guarded = promise.catch((err: unknown) => err)
    controller.abort()
    await vi.advanceTimersByTimeAsync(0)

    const err = await guarded
    expect(err).toBeInstanceOf(AiError)
    expect((err as AiError).message).toMatch(/resume/i)
  })

  it('gives up after the 60-minute cap with a resumable message', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation(() => Promise.resolve(jsonResponse({ status: 'in_progress' }))))
    await expect(settle(awaitDeepResearch('int-1'))).rejects.toThrow(/60 minutes/)
  })
})
