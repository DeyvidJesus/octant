import type { AiProviderId } from '@/types/ai'

// Provider-agnostic AI interface: normalized messages in, text out. Domain logic and
// guardrails live in `services/ai/tasks` and `services/ai/guardrails`.

export type ChatRole = 'system' | 'user' | 'assistant'

export interface ChatMessage {
  role: ChatRole
  content: string
}

export interface CompletionRequest {
  messages: ChatMessage[]
  model: string
  /** Omitted for local providers that need no auth. */
  apiKey?: string
  /** Override endpoint (local/OpenRouter). */
  baseUrl?: string
  temperature?: number
  maxTokens?: number
  /** Ground in live web search. Providers that can't must throw AiError, not answer from memory. */
  webSearch?: boolean
  signal?: AbortSignal
}

export interface CompletionResult {
  text: string
  /** Echoed back so callers can record which model actually ran. */
  model: string
  providerId: AiProviderId
}

export interface LLMProvider {
  readonly id: AiProviderId
  complete(request: CompletionRequest): Promise<CompletionResult>
}

/** Hosted-vendor keys live in the ai-proxy Edge Function; `apiKey` is only set for local models. */
export interface AiRunConfig {
  providerId: AiProviderId
  model: string
  apiKey?: string
  baseUrl?: string
}

/** All provider failures surface as this, with a user-readable message. */
export class AiError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options)
    this.name = 'AiError'
  }
}
