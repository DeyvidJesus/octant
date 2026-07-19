import { AiError, type CompletionRequest, type CompletionResult } from '../types'
import type { AiProviderId } from '@/types/ai'
import { supabase } from '@/services/supabase/client'

interface OpenAiCompatibleOptions {
  providerId: AiProviderId
  endpoint: string
  requiresApiKey: boolean
  extraHeaders?: Record<string, string>
}

/** Same-project Edge Function that holds vendor keys and makes hosted AI calls server-side. */
const AI_PROXY_URL = `${import.meta.env.VITE_SUPABASE_URL ?? ''}/functions/v1/ai-proxy`

/**
 * Runs a hosted-provider completion through the Supabase Edge Function proxy (`ai-proxy`).
 *
 * The browser never holds or sends a vendor API key or vendor URL — it POSTs the normalized request
 * with the user's Supabase JWT, and the Edge Function injects the key (from its own environment),
 * calls the vendor, and returns a normalized `{ text, model }`. This is what fixes both API-key
 * exposure and vendor CORS. Local (offline) models keep calling direct via `completeOpenAiCompatible`.
 */
export async function completeViaProxy(
  request: CompletionRequest,
  providerId: AiProviderId,
): Promise<CompletionResult> {
  if (request.webSearch) {
    // Fail fast, before any network — these providers can't ground on live search.
    throw new AiError(`${providerId}: web search grounding is not supported by this provider.`)
  }

  // getSession() reads the session from local storage — no network round-trip (see Phase 3).
  const { data: { session } } = await supabase.auth.getSession()
  const token = session?.access_token
  if (!token) throw new AiError('You must be signed in to use AI features.')

  const data = await postJson(
    AI_PROXY_URL,
    { 'content-type': 'application/json', authorization: `Bearer ${token}` },
    {
      providerId,
      model: request.model,
      messages: request.messages,
      temperature: request.temperature,
      maxTokens: request.maxTokens,
      webSearch: request.webSearch,
    },
    request.signal,
    providerId,
  )

  const text = data?.text
  if (typeof text !== 'string' || text.length === 0) {
    throw new AiError(`${providerId}: the AI proxy returned no text content.`)
  }

  return {
    text,
    model: typeof data?.model === 'string' ? data.model : request.model,
    providerId,
  }
}

/**
 * Direct `/chat/completions` call for LOCAL, offline servers (Ollama, LM Studio) — those run on the
 * user's machine, carry no key, and a cloud Edge Function cannot reach them. Hosted providers
 * (OpenAI, OpenRouter) go through `completeViaProxy` instead so their keys stay server-side.
 * System messages are supported natively, so no message rewriting is needed here.
 */
export async function completeOpenAiCompatible(
  request: CompletionRequest,
  options: OpenAiCompatibleOptions,
): Promise<CompletionResult> {
  if (request.webSearch) {
    // Silently ignoring the flag would return listings hallucinated from
    // parametric memory — worse than failing.
    throw new AiError(`${options.providerId}: web search grounding is not supported by this provider.`)
  }

  const headers: Record<string, string> = {
    'content-type': 'application/json',
    ...options.extraHeaders,
  }

  if (request.apiKey) {
    headers.authorization = `Bearer ${request.apiKey}`
  } else if (options.requiresApiKey) {
    throw new AiError(`${options.providerId}: an API key is required.`)
  }

  const data = await postJson(
    options.endpoint,
    headers,
    {
      model: request.model,
      messages: request.messages,
      temperature: request.temperature,
      max_tokens: request.maxTokens,
    },
    request.signal,
    options.providerId,
  )

  const text = data?.choices?.[0]?.message?.content
  if (typeof text !== 'string') {
    throw new AiError(`${options.providerId}: unexpected response shape (no message content).`)
  }

  return {
    text,
    model: typeof data?.model === 'string' ? data.model : request.model,
    providerId: options.providerId,
  }
}

/** Shared POST helper: network + HTTP error handling with readable messages. */
export async function postJson(
  endpoint: string,
  headers: Record<string, string>,
  body: unknown,
  signal: AbortSignal | undefined,
  providerId: string,
  // eslint-disable-next-line -- untyped JSON boundary; each adapter validates the shape it needs
): Promise<any> {
  let response: Response
  try {
    response = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal,
    })
  } catch (err) {
    const local = endpoint.includes('localhost') || endpoint.includes('127.0.0.1')
    throw new AiError(
      `${providerId}: could not reach the provider.${
        local ? ' Is your local model server running?' : ' Check your connection.'
      }`,
      { cause: err },
    )
  }

  if (!response.ok) {
    throw new AiError(`${providerId} request failed (HTTP ${response.status}). ${await safeErrorDetail(response)}`)
  }

  return response.json()
}

async function safeErrorDetail(response: Response): Promise<string> {
  try {
    const body = await response.text()
    const parsed = JSON.parse(body)
    const message = parsed?.error?.message ?? parsed?.message ?? parsed?.error
    return typeof message === 'string' ? message : body.slice(0, 200)
  } catch {
    return 'Verify your API key and model id.'
  }
}
