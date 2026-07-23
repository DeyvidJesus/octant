import { getProvider } from '../providers'
import { AiError, type AiRunConfig, type ChatMessage } from '../types'
import {
  EXTRACT_SYSTEM_PROMPT,
  MAX_INPUT_CHARS,
  buildExtractPrompt,
  normalizeCandidates,
  parseJobsJson,
  type ExtractedJob,
} from './extractJobsCore'

/**
 * The single extraction seam of Job Discovery. Every source — a pasted Deep
 * Research report, an in-app sweep, an in-app Deep Research run — funnels its
 * raw text through here.
 *
 * Division of labor: the LLM only *transcribes* jobs it can see in the report
 * into JSON; all validation, normalization, and truth decisions happen in the
 * deterministic core (`extractJobsCore`). A malformed or inventive model output
 * degrades into dropped entries and warnings — never into fabricated board data.
 *
 * The pure helpers live in `extractJobsCore` (no provider/network imports) so the
 * Deno discovery worker can share them; they are re-exported here for existing callers.
 */

export type { ExtractedJob }
export {
  MAX_CANDIDATES,
  MAX_DESCRIPTION_CHARS,
  buildExtractPrompt,
  parseJobsJson,
  coerceWorkMode,
  normalizeCandidates,
  toCandidates,
} from './extractJobsCore'

export interface ExtractJobsResult {
  jobs: ExtractedJob[]
  model: string
  providerId: string
  warnings: string[]
}

export async function extractJobs(
  reportText: string,
  config: AiRunConfig,
  signal?: AbortSignal,
): Promise<ExtractJobsResult> {
  const warnings: string[] = []
  let input = reportText.trim()
  if (input.length > MAX_INPUT_CHARS) {
    input = input.slice(0, MAX_INPUT_CHARS)
    warnings.push(`Report truncated to ${MAX_INPUT_CHARS.toLocaleString()} characters.`)
  }

  const provider = getProvider(config.providerId)
  const messages: ChatMessage[] = [
    { role: 'system', content: EXTRACT_SYSTEM_PROMPT },
    { role: 'user', content: buildExtractPrompt(input) },
  ]

  const complete = (msgs: ChatMessage[]) =>
    provider.complete({
      model: config.model,
      apiKey: config.apiKey,
      baseUrl: config.baseUrl,
      temperature: 0,
      maxTokens: 4000,
      signal,
      messages: msgs,
    })

  const first = await complete(messages)
  let parsed: unknown
  try {
    parsed = parseJobsJson(first.text)
  } catch {
    // One corrective retry: show the model its own bad output and insist.
    const retry = await complete([
      ...messages,
      { role: 'assistant', content: first.text },
      { role: 'user', content: 'That was not valid JSON. Reply with ONLY the JSON array. No explanation, no code fences.' },
    ])
    try {
      parsed = parseJobsJson(retry.text)
    } catch {
      throw new AiError(
        'The model did not return valid JSON after two attempts. Try a more capable model, or shorten the pasted report.',
      )
    }
  }

  const normalized = normalizeCandidates(parsed)
  return {
    jobs: normalized.jobs,
    model: first.model,
    providerId: first.providerId,
    warnings: [...warnings, ...normalized.warnings],
  }
}
