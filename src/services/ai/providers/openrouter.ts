import type { LLMProvider } from '../types'
import { completeViaProxy } from './openAiCompatible'

/**
 * OpenRouter (any model). The vendor URL, API key, and attribution headers live server-side in the
 * `ai-proxy` Edge Function; the browser forwards the normalized request with the user's Supabase JWT.
 */
export const openrouterProvider: LLMProvider = {
  id: 'openrouter',
  complete: (request) => completeViaProxy(request, 'openrouter'),
}
