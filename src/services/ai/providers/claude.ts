import type { LLMProvider } from '../types'
import { completeViaProxy } from './openAiCompatible'

/**
 * Anthropic Messages API. The vendor URL, API key, and wire-format translation (system prompt as a
 * top-level field, content-block responses) now live server-side in the `ai-proxy` Edge Function;
 * the browser only forwards the normalized request with the user's Supabase JWT.
 */
export const claudeProvider: LLMProvider = {
  id: 'claude',
  complete: (request) => completeViaProxy(request, 'claude'),
}
