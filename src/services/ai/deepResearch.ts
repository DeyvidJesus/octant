import type { AiProviderId } from '@/types/ai'
import { AiError } from './types'

/**
 * On-demand Deep Research runner — the exhaustive (and paid) discovery path.
 *
 * This is deliberately NOT an `LLMProvider`: research agents are long-lived
 * background interactions (start → poll → retrieve), a different shape from a
 * chat completion. The vendor wire format stays fully encapsulated here, the
 * one place in the app where that is allowed (services/ai).
 *
 * It is keyed off the Gemini key in the vault, independent of the active
 * provider — you can reason with Claude and still research with Gemini.
 * Extraction of the finished report always runs through the provider-agnostic
 * `extractJobs` seam like every other discovery source.
 */

const BASE = 'https://generativelanguage.googleapis.com/v1beta/interactions'
const AGENT = 'deep-research-preview-04-2026'

/** Runs are long and cost real money — the UI must show this before starting. */
export const DEEP_RESEARCH_HINT =
  'Runs on your Google Gemini API key. Typical run: 5–20 minutes, roughly $1–3 in API usage.'

/** Poll fast at first (some runs finish quickly), then settle into a slow cadence. */
const FAST_POLL_MS = 10_000
const FAST_POLL_COUNT = 12
const SLOW_POLL_MS = 30_000
const MAX_RUN_MS = 60 * 60 * 1000
/** Transient network blips shouldn't kill a 20-minute run. */
const MAX_CONSECUTIVE_POLL_FAILURES = 3

export interface DeepResearchConfig {
  apiKey: string
}

/** Available iff a Gemini key exists in the vault — regardless of active provider. */
export function resolveDeepResearchConfig(
  apiKeys: Partial<Record<AiProviderId, string>>,
): DeepResearchConfig | null {
  const apiKey = apiKeys.gemini
  return apiKey ? { apiKey } : null
}

export interface DeepResearchProgress {
  status: 'queued' | 'in_progress'
  elapsedMs: number
  polls: number
}

interface InteractionResponse {
  id?: string
  status?: string
  steps?: Array<{ content?: Array<{ type?: string; text?: string }> }>
  error?: { message?: string }
}

async function callInteractions(
  path: string,
  apiKey: string,
  init: { method: 'GET' | 'POST'; body?: unknown },
  signal?: AbortSignal,
): Promise<InteractionResponse> {
  let response: Response
  try {
    response = await fetch(`${BASE}${path}`, {
      method: init.method,
      headers: {
        'content-type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
      signal,
    })
  } catch (err) {
    if (signal?.aborted) throw err
    // Browser-blocked (CORS) or offline. The paste path is the designed escape hatch.
    throw new AiError(
      'Your browser blocked or could not reach the Deep Research API. Run Deep Research in the Gemini app instead — it can even run on a daily schedule — and paste the report into the Paste tab.',
      { cause: err },
    )
  }

  if (!response.ok) {
    let detail = ''
    try {
      const body = (await response.json()) as InteractionResponse
      detail = body?.error?.message ?? ''
    } catch {
      // Non-JSON error body — the status code alone will have to do.
    }
    throw new AiError(`Deep Research request failed (HTTP ${response.status}). ${detail}`.trim())
  }

  return response.json() as Promise<InteractionResponse>
}

/** Starts a background research run and returns its id for polling/resume. */
export async function startDeepResearch(
  prompt: string,
  config: DeepResearchConfig,
  signal?: AbortSignal,
): Promise<{ interactionId: string }> {
  const data = await callInteractions(
    '',
    config.apiKey,
    {
      method: 'POST',
      body: {
        agent: AGENT,
        input: prompt,
        background: true,
        // Persist server-side so a page reload can resume polling by id.
        store: true,
        agent_config: { type: 'deep-research' },
        tools: [{ type: 'google_search' }],
      },
    },
    signal,
  )

  if (typeof data.id !== 'string' || !data.id) {
    throw new AiError('Deep Research: unexpected response shape (no interaction id).')
  }
  return { interactionId: data.id }
}

function abortableSleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(makeAbortError())
      return
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort)
      resolve()
    }, ms)
    const onAbort = () => {
      clearTimeout(timer)
      reject(makeAbortError())
    }
    signal?.addEventListener('abort', onAbort, { once: true })
  })
}

function makeAbortError(): AiError {
  return new AiError('Deep Research polling paused. The run continues on the server — you can resume waiting anytime.')
}

/**
 * Polls an interaction until it completes and returns the final report text.
 * Abort/timeout leave the server-side run alive — callers keep the pending
 * interaction id so the user can resume; clear it only on completed/failed.
 */
export async function awaitDeepResearch(
  interactionId: string,
  config: DeepResearchConfig,
  opts: { signal?: AbortSignal; onProgress?: (progress: DeepResearchProgress) => void } = {},
): Promise<string> {
  const startedAt = Date.now()
  let polls = 0
  let consecutiveFailures = 0

  for (;;) {
    const elapsedMs = Date.now() - startedAt
    if (elapsedMs >= MAX_RUN_MS) {
      throw new AiError(
        'Deep Research is still running after 60 minutes. The run was not lost — you can resume waiting later.',
      )
    }

    await abortableSleep(polls < FAST_POLL_COUNT ? FAST_POLL_MS : SLOW_POLL_MS, opts.signal)
    polls += 1

    let data: InteractionResponse
    try {
      data = await callInteractions(`/${interactionId}`, config.apiKey, { method: 'GET' }, opts.signal)
      consecutiveFailures = 0
    } catch (err) {
      if (opts.signal?.aborted) throw err
      consecutiveFailures += 1
      if (consecutiveFailures >= MAX_CONSECUTIVE_POLL_FAILURES) throw err
      continue
    }

    if (data.status === 'completed') {
      const steps = data.steps ?? []
      const text = steps[steps.length - 1]?.content?.find((block) => typeof block?.text === 'string')?.text
      if (typeof text !== 'string' || !text) {
        throw new AiError('Deep Research completed but returned no report text.')
      }
      return text
    }

    if (data.status === 'failed') {
      throw new AiError(`Deep Research run failed. ${data.error?.message ?? ''}`.trim())
    }

    opts.onProgress?.({
      status: data.status === 'queued' ? 'queued' : 'in_progress',
      elapsedMs: Date.now() - startedAt,
      polls,
    })
  }
}
