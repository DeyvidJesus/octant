import type { LLMProvider } from '../types'
import { completeViaProxy } from './openAiCompatible'

/**
 * Google Gemini. Runs server-side through the `ai-proxy` Edge Function: the Gemini key lives in the
 * function environment (`GEMINI_API_KEY`), never in the browser bundle, and the proxy owns the
 * Google `generateContent` wire format (systemInstruction / contents / google_search grounding).
 * Gemini is the one hosted provider that can ground on live search, so `webSearch` is forwarded.
 */
export const geminiProvider: LLMProvider = {
  id: 'gemini',
  complete(request) {
    return completeViaProxy(request, 'gemini')
  },
}
