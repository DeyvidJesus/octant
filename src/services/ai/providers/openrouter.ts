import type { LLMProvider } from '../types'
import { completeOpenAiCompatible } from './openAiCompatible'

const DEFAULT_ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions'

export const openrouterProvider: LLMProvider = {
  id: 'openrouter',
  complete: (request) =>
    completeOpenAiCompatible(request, {
      providerId: 'openrouter',
      endpoint: request.baseUrl?.trim() || DEFAULT_ENDPOINT,
      requiresApiKey: true,
      // OpenRouter attributes usage to an app via these optional headers.
      extraHeaders: {
        'HTTP-Referer': 'https://career-os.local',
        'X-Title': 'CareerOS',
      },
    }),
}
