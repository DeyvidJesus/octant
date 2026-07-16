import type { JobAnalysis } from '@/types/analysis'
import type { TailoredResume } from '@/types/generator'
import { extractSkills } from '@/services/analysis/extract'

/**
 * Live ATS coverage of the *generated* document: which JD skills does the
 * currently-included content actually mention? Recomputed as the user toggles
 * bullets, so trimming a resume line shows its keyword cost immediately.
 * Same weighting as the analyzer's atsScore (required×2, frequency-weighted),
 * so the two numbers are comparable.
 */

export interface CoverageReport {
  /** 0-100, weighted share of JD skills present in the included content. */
  score: number
  covered: string[]
  missing: string[]
}

/** Only content that will actually render/export counts toward coverage. */
export function assembleIncludedText(tailored: TailoredResume): string {
  const parts: string[] = [
    tailored.header.role,
    tailored.summary,
    ...tailored.skillGroups.flatMap((group) => group.skills.map((skill) => skill.canonical)),
    ...tailored.experience.flatMap((entry) => [
      entry.role,
      ...entry.bullets.filter((bullet) => bullet.included).map((bullet) => `${bullet.text} ${bullet.metric ?? ''}`),
    ]),
    ...tailored.projects
      .filter((project) => project.included)
      .flatMap((project) => [
        project.name,
        project.tech.join(' '),
        project.description,
        ...project.bullets.filter((bullet) => bullet.included).map((bullet) => bullet.text),
      ]),
  ]
  return parts.join('\n')
}

export function computeCoverage(tailored: TailoredResume, analysis: JobAnalysis): CoverageReport {
  const present = new Set<string>()
  for (const hit of extractSkills(assembleIncludedText(tailored))) {
    present.add(hit.entry.canonical)
  }

  let totalWeight = 0
  let coveredWeight = 0
  const covered: string[] = []
  const missing: string[] = []

  for (const skill of analysis.detectedStack) {
    const weight = skill.count * (skill.importance === 'required' ? 2 : 1)
    totalWeight += weight
    if (present.has(skill.canonical)) {
      coveredWeight += weight
      covered.push(skill.canonical)
    } else {
      missing.push(skill.canonical)
    }
  }

  return {
    score: totalWeight === 0 ? 0 : Math.round((coveredWeight / totalWeight) * 100),
    covered,
    missing,
  }
}
