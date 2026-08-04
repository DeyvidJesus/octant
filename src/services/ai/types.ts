import type { AiProviderId } from '@/types/ai'

/**
 * The AI seam of Octant. Every provider (Claude, OpenAI, Gemini, OpenRouter,
 * local models, future vendors) implements this one interface; the rest of the
 * app talks only in normalized messages and never sees a vendor wire format.
 *
 * This layer is deliberately dumb: it moves messages in and text out. It knows
 * nothing about resumes, jobs, or truth. Domain intelligence and the
 * anti-hallucination guardrails live one layer up, in `services/ai/tasks` and
 * `services/ai/guardrails`.
 */

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
  /**
   * Ground this completion in live web search results. Providers that cannot
   * MUST throw AiError rather than silently answer from parametric memory —
   * an ungrounded "current job listing" is a hallucination.
   */
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

/** Everything a task needs to reach a provider. Hosted-vendor keys live server-side in the ai-proxy
 * Edge Function; `apiKey` is only ever set for a local (offline) model with a custom config. */
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
