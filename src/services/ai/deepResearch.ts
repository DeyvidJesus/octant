import { AiError } from './types'
import { supabase } from '@/services/supabase/client'

/**
 * On-demand Deep Research runner — the exhaustive discovery path.
 *
 * This is deliberately NOT an `LLMProvider`: research agents are long-lived
 * background interactions (start → poll → retrieve), a different shape from a
 * chat completion.
 *
 * The Gemini key lives server-side: every call goes through the `deep-research`
 * Edge Function (which holds GEMINI_API_KEY and forwards to Google), authorized
 * with the user's Supabase JWT. The key never reaches the browser, and running
 * server-side also sidesteps the vendor CORS wall that blocked the old
 * direct-from-browser path. Extraction of the finished report still runs through
 * the provider-agnostic `extractJobs` seam like every other discovery source.
 */

/** Same-project Edge Function that holds the Gemini key and forwards Deep Research start/poll. */
const DEEP_RESEARCH_URL = `${import.meta.env.VITE_SUPABASE_URL ?? ''}/functions/v1/deep-research`

/** Runs are long — the UI must set expectations before starting. */
export const DEEP_RESEARCH_HINT =
  'Runs an exhaustive Google Gemini research agent server-side. Typical run: 5–20 minutes.'

/** Poll fast at first (some runs finish quickly), then settle into a slow cadence. */
const FAST_POLL_MS = 10_000
const FAST_POLL_COUNT = 12
const SLOW_POLL_MS = 30_000
const MAX_RUN_MS = 60 * 60 * 1000
/** Transient network blips shouldn't kill a 20-minute run. */
const MAX_CONSECUTIVE_POLL_FAILURES = 3

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

interface DeepResearchCall {
  action: 'start' | 'poll'
  prompt?: string
  interactionId?: string
}

async function callDeepResearchFn(
  body: DeepResearchCall,
  signal?: AbortSignal,
): Promise<InteractionResponse> {
  // getSession() reads the session from local storage — no network round-trip.
  const { data: { session } } = await supabase.auth.getSession()
  const token = session?.access_token
  if (!token) throw new AiError('You must be signed in to run Deep Research.')

  let response: Response
  try {
    response = await fetch(DEEP_RESEARCH_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
      signal,
    })
  } catch (err) {
    if (signal?.aborted) throw err
    throw new AiError(
      'Could not reach the Deep Research service. Check your connection and try again — or run Deep Research in the Gemini app and paste the report into the Paste tab.',
      { cause: err },
    )
  }

  if (!response.ok) {
    let detail = ''
    try {
      const errorBody = (await response.json()) as InteractionResponse
      detail = errorBody?.error?.message ?? ''
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
  signal?: AbortSignal,
): Promise<{ interactionId: string }> {
  const data = await callDeepResearchFn({ action: 'start', prompt }, signal)

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
      data = await callDeepResearchFn({ action: 'poll', interactionId }, opts.signal)
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
