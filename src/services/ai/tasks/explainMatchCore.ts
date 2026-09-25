import type { JobOpportunity } from '@/types/job'
import type { MasterResume } from '@/types/resume'
import type { JobAnalysis } from '@/types/analysis'

// Prompt builder for the Recruiter Read. No provider imports: the Deno worker imports this file.

export interface ExplainMatchInput {
  job: JobOpportunity
  resume: MasterResume
  analysis: JobAnalysis
}

export const EXPLAIN_SYSTEM_PROMPT = [
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

function list(items: string[]): string {
  return items.length ? items.join(', ') : 'none'
}

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
