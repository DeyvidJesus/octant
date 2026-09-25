import type { LLMProvider } from '../types'
import { completeViaProxy } from './openAiCompatible'

/** OpenAI; the key lives in the `ai-proxy` Edge Function. */
export const openaiProvider: LLMProvider = {
  id: 'openai',
  complete: (request) => completeViaProxy(request, 'openai'),
}
