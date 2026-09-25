import { extractSkills } from '@/services/analysis/extract'

export interface GroundingReport {
  /** True when every skill the AI named traces back to a known fact. */
  ok: boolean
  /** Skills in the AI text found in neither the resume nor the JD, so possibly invented. */
  unverifiedSkills: string[]
}

/** Deterministic anti-hallucination check: flags skills in AI text that aren't in the known set. */
export function checkGrounding(text: string, knownCanonical: Set<string>): GroundingReport {
  const mentioned = extractSkills(text).map((hit) => hit.entry.canonical)
  const unverified = [...new Set(mentioned.filter((canonical) => !knownCanonical.has(canonical)))]

  return {
    ok: unverified.length === 0,
    unverifiedSkills: unverified,
  }
}
