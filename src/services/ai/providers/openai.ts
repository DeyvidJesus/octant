import type { LLMProvider } from '../types'
import { completeViaProxy } from './openAiCompatible'

/**
 * OpenAI ChatGPT. The vendor URL and API key live server-side in the `ai-proxy` Edge Function;
 * the browser forwards the normalized request with the user's Supabase JWT.
 */
export const openaiProvider: LLMProvider = {
  id: 'openai',
  complete: (request) => completeViaProxy(request, 'openai'),
}
