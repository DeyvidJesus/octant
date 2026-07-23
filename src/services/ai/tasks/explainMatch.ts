import { collectResumeSkills } from '@/services/analysis/match'
import { getProvider } from '../providers'
import { checkGrounding, type GroundingReport } from '../guardrails/grounding'
import type { AiRunConfig } from '../types'
import { EXPLAIN_SYSTEM_PROMPT, buildUserPrompt, type ExplainMatchInput } from './explainMatchCore'

/**
 * "Recruiter Read" — CareerOS's first AI task and the proof of the whole
 * pipeline (provider adapter + guardrail).
 *
 * The deterministic analyzer already produced the *truth*: the match score,
 * which skills overlap, which requirements are missing. This task turns those
 * facts into an experienced recruiter's honest judgment. The LLM never computes
 * the match and is given only real, structured facts; its output is verified by
 * the grounding guardrail before display.
 *
 * The pure prompt builder lives in `explainMatchCore` (no provider import) so the
 * Deno discovery worker can share it; re-exported here for existing callers.
 */

export type { ExplainMatchInput } from './explainMatchCore'
export { EXPLAIN_SYSTEM_PROMPT, buildUserPrompt } from './explainMatchCore'

export interface ExplainMatchResult {
  text: string
  grounding: GroundingReport
  model: string
  providerId: string
}

export async function explainMatch(input: ExplainMatchInput, config: AiRunConfig): Promise<ExplainMatchResult> {
  const provider = getProvider(config.providerId)
  const result = await provider.complete({
    model: config.model,
    apiKey: config.apiKey,
    baseUrl: config.baseUrl,
    temperature: 0.4,
    maxTokens: 700,
    messages: [
      { role: 'system', content: EXPLAIN_SYSTEM_PROMPT },
      { role: 'user', content: buildUserPrompt(input) },
    ],
  })

  // Known facts = every skill the resume can truthfully claim, plus every skill
  // the job description itself named. Anything outside this set is potentially invented.
  const known = collectResumeSkills(input.resume)
  for (const skill of input.analysis.detectedStack) known.add(skill.canonical)

  return {
    text: result.text,
    grounding: checkGrounding(result.text, known),
    model: result.model,
    providerId: result.providerId,
  }
}
