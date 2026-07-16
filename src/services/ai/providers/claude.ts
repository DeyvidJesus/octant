import { AiError, type LLMProvider } from '../types'
import { postJson } from './openAiCompatible'

const DEFAULT_ENDPOINT = 'https://api.anthropic.com/v1/messages'
const ANTHROPIC_VERSION = '2023-06-01'

/**
 * Anthropic Messages API. Differs from the OpenAI shape in two ways handled
 * here: the system prompt is a top-level field (not a message), and responses
 * come back as an array of content blocks.
 */
export const claudeProvider: LLMProvider = {
  id: 'claude',
  async complete(request) {
    if (!request.apiKey) throw new AiError('Claude: an API key is required.')
    if (request.webSearch) {
      // Silently ignoring the flag would return listings hallucinated from
      // parametric memory — worse than failing.
      throw new AiError('Claude: web search grounding is not supported by this adapter yet.')
    }

    const system = request.messages
      .filter((message) => message.role === 'system')
      .map((message) => message.content)
      .join('\n\n')

    const messages = request.messages
      .filter((message) => message.role !== 'system')
      .map((message) => ({ role: message.role, content: message.content }))

    const data = await postJson(
      request.baseUrl?.trim() || DEFAULT_ENDPOINT,
      {
        'content-type': 'application/json',
        'x-api-key': request.apiKey,
        'anthropic-version': ANTHROPIC_VERSION,
        // Opt in to calling the API directly from the browser (no proxy),
        // which keeps CareerOS fully local-first.
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      {
        model: request.model,
        max_tokens: request.maxTokens ?? 1024,
        temperature: request.temperature,
        system: system || undefined,
        messages,
      },
      request.signal,
      'Claude',
    )

    const text = Array.isArray(data?.content)
      ? data.content
          .filter((block: { type?: string }) => block?.type === 'text')
          .map((block: { text?: string }) => block.text ?? '')
          .join('')
      : undefined

    if (typeof text !== 'string' || text.length === 0) {
      throw new AiError('Claude: unexpected response shape (no text content).')
    }

    return { text, model: typeof data?.model === 'string' ? data.model : request.model, providerId: 'claude' }
  },
}
