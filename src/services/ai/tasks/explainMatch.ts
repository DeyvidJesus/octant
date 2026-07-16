import type { JobOpportunity } from '@/types/job'
import type { MasterResume } from '@/types/resume'
import type { JobAnalysis } from '@/types/analysis'
import { collectResumeSkills } from '@/services/analysis/match'
import { getProvider } from '../providers'
import { checkGrounding, type GroundingReport } from '../guardrails/grounding'
import type { AiRunConfig } from '../types'

/**
 * "Recruiter Read" — CareerOS's first AI task and the proof of the whole
 * pipeline (provider adapter + guardrail).
 *
 * The deterministic analyzer already produced the *truth*: the match score,
 * which skills overlap, which requirements are missing. This task does the one
 * thing deterministic code is bad at — turning those facts into an experienced
 * recruiter's honest judgment about whether to interview the candidate. The
 * LLM never computes the match and is given only real, structured facts; its
 * output is then verified by the grounding guardrail before display.
 */

export interface ExplainMatchInput {
  job: JobOpportunity
  resume: MasterResume
  analysis: JobAnalysis
}

export interface ExplainMatchResult {
  text: string
  grounding: GroundingReport
  model: string
  providerId: string
}

const SYSTEM_PROMPT = [
  'You are a seasoned technical recruiter and career coach for software engineers.',
  'You are reviewing one candidate against one specific role, on the candidate’s behalf.',
  '',
  'Hard rules:',
  '- Use ONLY the facts provided in the user message. Never invent skills, employers, seniority, metrics, or experience.',
  '- If the candidate is missing a required skill, say so plainly. Do not paper over gaps or flatter.',
  '- Do NOT name any technology or skill that is not in the provided lists.',
  '- Be specific and concise. No generic filler, no restating the inputs verbatim.',
  '- Write in second person to the candidate ("you").',
].join('\n')

/** Exported for testing: assembles the grounded fact sheet the model reasons over. */
export function buildUserPrompt(input: ExplainMatchInput): string {
  const { job, analysis } = input
  const missingRequired = analysis.detectedStack
    .filter((skill) => !skill.inResume && skill.importance === 'required')
    .map((skill) => skill.canonical)
  const missingPreferred = analysis.detectedStack
    .filter((skill) => !skill.inResume && skill.importance === 'preferred')
    .map((skill) => skill.canonical)

  const evidence = analysis.seniorityEvidence.length
    ? ` (evidence: ${analysis.seniorityEvidence.join(', ')})`
    : ''

  return [
    `ROLE: ${job.role} at ${job.company}`,
    `DETECTED SENIORITY: ${analysis.detectedSeniority}${evidence}`,
    `ATS KEYWORD COVERAGE: ${analysis.match.atsScore}%`,
    `STRENGTHS (skills the job wants that ARE in the candidate’s Master Resume): ${list(analysis.match.matched)}`,
    `MISSING MUST-HAVES (required by the job, NOT in the resume): ${list(missingRequired)}`,
    `MISSING NICE-TO-HAVES (optional in the job, NOT in the resume): ${list(missingPreferred)}`,
    '',
    'Give your honest recruiter read of this candidate for THIS role:',
    '1. Verdict — would you advance them to a first interview? Yes/no and why, in one or two sentences.',
    '2. Strongest angles to emphasize (only from the STRENGTHS above).',
    '3. The gaps most likely to cost an interview, and how to address or honestly reframe them.',
    '4. One concrete action to raise their odds for this role.',
    'Keep the whole response under 250 words.',
  ].join('\n')
}

function list(items: string[]): string {
  return items.length ? items.join(', ') : 'none'
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
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: buildUserPrompt(input) },
    ],
  })

  // Known facts = every skill the resume can truthfully claim, plus every skill
  // the job description itself named. Anything outside this set that the model
  // mentions is treated as potentially invented.
  const known = collectResumeSkills(input.resume)
  for (const skill of input.analysis.detectedStack) known.add(skill.canonical)

  return {
    text: result.text,
    grounding: checkGrounding(result.text, known),
    model: result.model,
    providerId: result.providerId,
  }
}
