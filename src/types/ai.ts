// The user's AI provider selection, independent of any vendor's wire format.

export type AiProviderId = 'claude' | 'openai' | 'gemini' | 'openrouter' | 'local'

export interface AiModelOption {
  id: string
  label: string
}

/** Static description of a selectable provider — powers the Settings UI. */
export interface AiProviderDescriptor {
  id: AiProviderId
  label: string
  /** Local models need no key; hosted ones do. */
  requiresApiKey: boolean
  /** OpenRouter / local can point at a custom endpoint. */
  allowsCustomBaseUrl: boolean
  /** Provider can ground a completion in live web search (CompletionRequest.webSearch). */
  supportsWebSearch?: boolean
  defaultBaseUrl?: string
  /** Suggested models — the user may type any model id the provider supports. */
  models: AiModelOption[]
  /** Where to get an API key. */
  docsUrl?: string
  hint?: string
}

/** The user's persisted, non-secret AI selection. Hosted-vendor keys live server-side (ai-proxy). */
export interface AiSettings {
  providerId: AiProviderId | null
  model: string
  baseUrl?: string
}
