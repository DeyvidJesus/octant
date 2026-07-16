import type { LLMProvider } from '../types'
import { completeOpenAiCompatible } from './openAiCompatible'

const DEFAULT_ENDPOINT = 'http://localhost:11434/v1/chat/completions'

/**
 * Any local OpenAI-compatible server (Ollama, LM Studio, llama.cpp). No key,
 * nothing leaves the machine. The user points `baseUrl` at their server.
 */
export const localProvider: LLMProvider = {
  id: 'local',
  complete: (request) =>
    completeOpenAiCompatible(request, {
      providerId: 'local',
      endpoint: request.baseUrl?.trim() || DEFAULT_ENDPOINT,
      requiresApiKey: false,
    }),
}
