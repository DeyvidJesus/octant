import type { LLMProvider } from '../types'
import { completeViaProxy } from './openAiCompatible'

/** Anthropic; key and wire-format translation live in the `ai-proxy` Edge Function. */
export const claudeProvider: LLMProvider = {
  id: 'claude',
  complete: (request) => completeViaProxy(request, 'claude'),
}
