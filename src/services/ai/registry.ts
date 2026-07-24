import type { AiProviderDescriptor, AiProviderId } from '@/types/ai'

/**
 * The provider catalog. Adding a vendor is a matter of adding a descriptor here
 * and an adapter in `providers/` — no UI or task code changes. Model lists are
 * suggestions only; the model field is free text so new models work the day
 * they ship, without a release of CareerOS.
 */
export const AI_PROVIDERS: AiProviderDescriptor[] = [
  {
    id: 'claude',
    label: 'Claude (Anthropic)',
    requiresApiKey: true,
    allowsCustomBaseUrl: false,
    models: [
      { id: 'claude-opus-4-8', label: 'Opus 4.8 (most capable)' },
      { id: 'claude-sonnet-5', label: 'Sonnet 5 (balanced)' },
      { id: 'claude-haiku-4-5-20251001', label: 'Haiku 4.5 (fast)' },
    ],
    docsUrl: 'https://console.anthropic.com/settings/keys',
    hint: 'Recommended for career reasoning. Uses direct browser access.',
  },
  {
    id: 'openai',
    label: 'OpenAI (ChatGPT)',
    requiresApiKey: true,
    allowsCustomBaseUrl: false,
    models: [
      { id: 'gpt-4o', label: 'GPT-4o' },
      { id: 'gpt-4o-mini', label: 'GPT-4o mini (fast)' },
    ],
    docsUrl: 'https://platform.openai.com/api-keys',
  },
  {
    id: 'gemini',
    label: 'Google Gemini',
    requiresApiKey: true,
    allowsCustomBaseUrl: false,
    supportsWebSearch: true,
    models: [
      { id: 'gemini-3.5-flash', label: 'Gemini 3.5 Flash' },
      { id: 'gemini-3.5-pro', label: 'Gemini 3.5 Pro' },
    ],
    docsUrl: 'https://aistudio.google.com/apikey',
  },
  {
    id: 'openrouter',
    label: 'OpenRouter (any model)',
    requiresApiKey: true,
    allowsCustomBaseUrl: true,
    defaultBaseUrl: 'https://openrouter.ai/api/v1/chat/completions',
    models: [
      { id: 'anthropic/claude-3.5-sonnet', label: 'Claude 3.5 Sonnet' },
      { id: 'openai/gpt-4o', label: 'GPT-4o' },
      { id: 'google/gemini-3.5-flash', label: 'Gemini 3.5 Flash' },
    ],
    docsUrl: 'https://openrouter.ai/keys',
    hint: 'One key, hundreds of models.',
  },
  {
    id: 'local',
    label: 'Local model (Ollama / LM Studio)',
    requiresApiKey: false,
    allowsCustomBaseUrl: true,
    defaultBaseUrl: 'http://localhost:11434/v1/chat/completions',
    models: [
      { id: 'llama3.1', label: 'Llama 3.1' },
      { id: 'qwen2.5-coder', label: 'Qwen2.5 Coder' },
    ],
    hint: 'Fully offline. Nothing leaves your machine. Requires a local OpenAI-compatible server.',
  },
]

export function getProviderDescriptor(id: AiProviderId): AiProviderDescriptor | undefined {
  return AI_PROVIDERS.find((provider) => provider.id === id)
}

/** Whether the provider can run search-grounded completions (job sweeps). */
export function providerSupportsWebSearch(id: AiProviderId | null): boolean {
  return Boolean(id && getProviderDescriptor(id)?.supportsWebSearch)
}
