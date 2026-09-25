import type { JobAnalysis } from '@/types/analysis'
import type { Accomplishment } from '@/types/resume'
import { extractSkills } from '@/services/analysis/extract'

// Tailoring relevance uses the same weighting as the ATS score: count, doubled for required skills.

export type JdWeights = Map<string, number>

export function buildJdWeights(analysis: JobAnalysis): JdWeights {
  const weights: JdWeights = new Map()
  for (const skill of analysis.detectedStack) {
    weights.set(skill.canonical, skill.count * (skill.importance === 'required' ? 2 : 1))
  }
  return weights
}

/** Curated tags plus taxonomy hits in the text, so untagged entries still rank. */
export function accomplishmentSkills(accomplishment: Accomplishment): Set<string> {
  const canonical = new Set<string>()
  for (const hit of extractSkills(
    [...accomplishment.skills, ...accomplishment.keywords, accomplishment.text, accomplishment.metric ?? ''].join('\n'),
  )) {
    canonical.add(hit.entry.canonical)
  }
  return canonical
}

export function scoreAccomplishment(accomplishment: Accomplishment, weights: JdWeights): number {
  let score = 0
  for (const skill of accomplishmentSkills(accomplishment)) {
    score += weights.get(skill) ?? 0
  }
  return score
}

/** Score free text (project descriptions, tech lists) the same way. */
export function scoreText(text: string, weights: JdWeights): number {
  let score = 0
  const seen = new Set<string>()
  for (const hit of extractSkills(text)) {
    if (seen.has(hit.entry.canonical)) continue
    seen.add(hit.entry.canonical)
    score += weights.get(hit.entry.canonical) ?? 0
  }
  return score
}
