import type { LLMProvider } from '../types'
import { completeViaProxy } from './openAiCompatible'

/** OpenRouter; key and attribution headers live in the `ai-proxy` Edge Function. */
export const openrouterProvider: LLMProvider = {
  id: 'openrouter',
  complete: (request) => completeViaProxy(request, 'openrouter'),
}
