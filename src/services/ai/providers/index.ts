import type { AiProviderId } from '@/types/ai'
import type { LLMProvider } from '../types'
import { claudeProvider } from './claude'
import { openaiProvider } from './openai'
import { geminiProvider } from './gemini'
import { openrouterProvider } from './openrouter'
import { localProvider } from './local'

const PROVIDERS: Record<AiProviderId, LLMProvider> = {
  claude: claudeProvider,
  openai: openaiProvider,
  gemini: geminiProvider,
  openrouter: openrouterProvider,
  local: localProvider,
}

/** The provider registry. Resolving by id is the only coupling point. */
export function getProvider(id: AiProviderId): LLMProvider {
  return PROVIDERS[id]
}
