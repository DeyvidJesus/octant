import { collectResumeSkills } from '@/services/analysis/match'
import { getProvider } from '../providers'
import { checkGrounding, type GroundingReport } from '../guardrails/grounding'
import type { AiRunConfig } from '../types'
import { EXPLAIN_SYSTEM_PROMPT, buildUserPrompt, type ExplainMatchInput } from './explainMatchCore'

// "Recruiter Read": the LLM explains the deterministic match result; it never computes the match.
// Output is checked by the grounding guardrail before display.

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

  // Known facts are resume skills plus JD skills; anything else may be invented.
  const known = collectResumeSkills(input.resume)
  for (const skill of input.analysis.detectedStack) known.add(skill.canonical)

  return {
    text: result.text,
    grounding: checkGrounding(result.text, known),
    model: result.model,
    providerId: result.providerId,
  }
}
