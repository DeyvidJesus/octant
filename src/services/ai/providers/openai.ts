import type { LLMProvider } from '../types'
import { completeOpenAiCompatible } from './openAiCompatible'

const ENDPOINT = 'https://api.openai.com/v1/chat/completions'

export const openaiProvider: LLMProvider = {
  id: 'openai',
  complete: (request) =>
    completeOpenAiCompatible(request, {
      providerId: 'openai',
      endpoint: ENDPOINT,
      requiresApiKey: true,
    }),
}
