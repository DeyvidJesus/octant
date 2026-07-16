import { AiError, type LLMProvider } from '../types'
import { postJson } from './openAiCompatible'

const DEFAULT_BASE = 'https://generativelanguage.googleapis.com/v1beta'

/**
 * Google Gemini `generateContent`. The system prompt is a `systemInstruction`,
 * roles are 'user' / 'model', and the key travels as a query param.
 */
export const geminiProvider: LLMProvider = {
  id: 'gemini',
  async complete(request) {
    if (!request.apiKey) throw new AiError('Gemini: an API key is required.')

    const system = request.messages
      .filter((message) => message.role === 'system')
      .map((message) => message.content)
      .join('\n\n')

    const contents = request.messages
      .filter((message) => message.role !== 'system')
      .map((message) => ({
        role: message.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: message.content }],
      }))

    const base = request.baseUrl?.trim() || DEFAULT_BASE
    const endpoint = `${base}/models/${encodeURIComponent(request.model)}:generateContent?key=${encodeURIComponent(request.apiKey)}`

    const data = await postJson(
      endpoint,
      { 'content-type': 'application/json' },
      {
        systemInstruction: system ? { parts: [{ text: system }] } : undefined,
        contents,
        // Search grounding is incompatible with structured output — callers
        // that need JSON run a separate ungrounded extraction pass.
        tools: request.webSearch ? [{ google_search: {} }] : undefined,
        generationConfig: {
          temperature: request.temperature,
          maxOutputTokens: request.maxTokens,
        },
      },
      request.signal,
      'Gemini',
    )

    const text = data?.candidates?.[0]?.content?.parts
      ?.map((part: { text?: string }) => part.text ?? '')
      .join('')

    if (typeof text !== 'string' || text.length === 0) {
      throw new AiError('Gemini: unexpected response shape (no text content).')
    }

    return { text, model: request.model, providerId: 'gemini' }
  },
}
