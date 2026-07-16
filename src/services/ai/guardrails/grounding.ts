import { extractSkills } from '@/services/analysis/extract'

export interface GroundingReport {
  /** True when every skill the AI named traces back to a known fact. */
  ok: boolean
  /**
   * Canonical skills mentioned in the AI text that exist in neither the Master
   * Resume nor the job description — i.e. the model may have invented them.
   */
  unverifiedSkills: string[]
}

/**
 * The anti-hallucination guardrail, enforced in deterministic code — not by
 * trusting the prompt.
 *
 * CareerOS's rule is that the LLM may rephrase and prioritize real facts but
 * never introduce new ones. This runs the same taxonomy extractor used for
 * analysis over the generated text and flags any skill it names that isn't in
 * the set of known facts (resume skills ∪ job-description skills). The
 * structured data model always wins: flagged claims are surfaced to the user
 * as untrusted rather than presented as fact.
 *
 * It is intentionally conservative — it verifies *skills/technologies*, the
 * category most prone to fabrication and the one that matters for ATS and
 * recruiter credibility. Callers decide how to present `unverifiedSkills`.
 */
export function checkGrounding(text: string, knownCanonical: Set<string>): GroundingReport {
  const mentioned = extractSkills(text).map((hit) => hit.entry.canonical)
  const unverified = [...new Set(mentioned.filter((canonical) => !knownCanonical.has(canonical)))]

  return {
    ok: unverified.length === 0,
    unverifiedSkills: unverified,
  }
}
