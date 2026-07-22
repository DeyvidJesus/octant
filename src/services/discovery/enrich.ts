import type { DiscoveredCandidate } from '@/types/discovery'
import type { MasterResume } from '@/types/resume'
import { buildUserPrompt, EXPLAIN_SYSTEM_PROMPT } from '@/services/ai/tasks/explainMatch'
import { checkGrounding } from '@/services/ai/guardrails/grounding'
import { collectResumeSkills } from '@/services/analysis/match'
import { candidateToEphemeralJob } from './pipeline'

/**
 * AI enrichment for the highest-relevance candidates (Phase 3 "Intelligence"). Deterministic score +
 * gaps already live on the candidate's persisted `analysis`; this adds the two things code is bad at:
 * a grounded fit EXPLANATION and an action RECOMMENDATION. Cost is controlled by only enriching the
 * top-K new candidates per run (plus on-demand from the card). Transport is injected so it runs in the
 * browser (ai-proxy) and the Deno worker (server key) unchanged. Reuses the Recruiter Read prompt +
 * grounding guardrail — a hallucinated explanation is dropped rather than persisted.
 */

export type EnrichCompleteFn = (system: string, user: string) => Promise<string>

export interface EnrichmentPatch {
  explanation?: string
  recommendation: string
  enrichmentStatus: 'done'
}

/** Deterministic action recommendation from the score + missing must-haves — no AI, always available. */
export function buildRecommendation(candidate: DiscoveredCandidate): string {
  const analysis = candidate.analysis
  if (!analysis) return 'Add the full job description to get a scored recommendation.'

  const score = candidate.matchScore ?? analysis.match.atsScore
  const missingRequired = analysis.detectedStack
    .filter((skill) => !skill.inResume && skill.importance === 'required')
    .map((skill) => skill.canonical)

  if (score >= 75 && missingRequired.length === 0) {
    return 'Strong match — apply now and tailor your resume to lead with your matched skills.'
  }
  if (score >= 55) {
    return missingRequired.length
      ? `Worth a tailored application — address or honestly reframe: ${missingRequired.slice(0, 3).join(', ')}.`
      : 'Worth a tailored application — lead with your strengths.'
  }
  return missingRequired.length
    ? `Stretch role — consider upskilling in ${missingRequired.slice(0, 3).join(', ')} before applying.`
    : 'Stretch role — apply only if it strongly aligns with your goals.'
}

/**
 * Produces the enrichment patch for a candidate. The recommendation is deterministic; the explanation
 * is a grounded AI read (dropped if it mentions skills outside the resume + job — anti-hallucination).
 */
export async function enrichCandidate(
  candidate: DiscoveredCandidate,
  resume: MasterResume,
  complete: EnrichCompleteFn,
): Promise<EnrichmentPatch> {
  const recommendation = buildRecommendation(candidate)
  if (!candidate.analysis) {
    return { recommendation, enrichmentStatus: 'done' }
  }

  const job = candidateToEphemeralJob(candidate)
  const analysis = candidate.analysis
  let explanation: string | undefined
  try {
    const text = await complete(EXPLAIN_SYSTEM_PROMPT, buildUserPrompt({ job, resume, analysis }))
    const known = collectResumeSkills(resume)
    for (const skill of analysis.detectedStack) known.add(skill.canonical)
    // Persist the explanation only if it's grounded (never store hallucinated skills).
    if (checkGrounding(text, known).ok) explanation = text.trim()
  } catch {
    // Explanation is best-effort; the deterministic recommendation still ships.
  }

  return { explanation, recommendation, enrichmentStatus: 'done' }
}
