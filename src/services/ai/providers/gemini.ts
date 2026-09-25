import type { LLMProvider } from '../types'
import { completeViaProxy } from './openAiCompatible'

/** Proxied through `ai-proxy`, which owns the key and wire format. The only provider that honors `webSearch`. */
export const geminiProvider: LLMProvider = {
  id: 'gemini',
  complete(request) {
    return completeViaProxy(request, 'gemini')
  },
}
