import { AiError, type CompletionRequest, type CompletionResult } from '../types'
import type { AiProviderId } from '@/types/ai'

interface OpenAiCompatibleOptions {
  providerId: AiProviderId
  endpoint: string
  requiresApiKey: boolean
  extraHeaders?: Record<string, string>
}

/**
 * The `/chat/completions` shape shared by OpenAI, OpenRouter, and most local
 * servers (Ollama, LM Studio). System messages are supported natively, so no
 * message rewriting is needed here.
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
