import type { CategoryScore, MatchReport } from '@/types/analysis'
import type { MasterResume } from '@/types/resume'
import { SKILL_CATEGORY_LABELS } from '@/constants/skillTaxonomy'
import { extractSkills, type TaxonomyHit } from './extract'

/**
 * Everything the Master Resume can truthfully claim, as canonical taxonomy
 * names: explicit skill lists, project tech, plus skills mentioned in the
 * summary and experience/project bullets.
 */
export function collectResumeSkills(resume: MasterResume): Set<string> {
  const explicitTerms = [
    ...resume.skills.flatMap((category) => category.skills),
    ...resume.projects.flatMap((project) => project.tech),
  ].join('\n')

  // Factual profile fields only — goals are aspirational and must never
  // contribute claimable skills.
  const narrativeText = [
    resume.summary,
    resume.personal.location,
    resume.personal.role,
    ...resume.experience.flatMap((entry) => entry.bullets),
    ...resume.projects.flatMap((project) => [project.description, ...project.bullets]),
  ].join('\n')

  const canonical = new Set<string>()
  for (const hit of extractSkills(`${explicitTerms}\n${narrativeText}`)) {
    canonical.add(hit.entry.canonical)
  }
  return canonical
}

/**
 * Builds the match report from JD hits vs the resume skill set.
 * `matched` is a strict intersection — this is the structural guarantee that
 * no analysis ever claims experience the resume doesn't contain.
 */
export function buildMatchReport(jdHits: TaxonomyHit[], resumeSkills: Set<string>): MatchReport {
  const matchedHits = jdHits.filter((hit) => resumeSkills.has(hit.entry.canonical))
  const missingHits = jdHits.filter((hit) => !resumeSkills.has(hit.entry.canonical))

  const totalWeight = jdHits.reduce((sum, hit) => sum + hit.count, 0)
  const matchedWeight = matchedHits.reduce((sum, hit) => sum + hit.count, 0)
  const atsScore = totalWeight === 0 ? 0 : Math.round((matchedWeight / totalWeight) * 100)

  return {
    atsScore,
    matched: matchedHits.map((hit) => hit.entry.canonical),
    missing: missingHits.map((hit) => hit.entry.canonical),
    categoryBreakdown: buildCategoryBreakdown(jdHits, resumeSkills),
    notes: buildNotes(atsScore, matchedHits, missingHits),
  }
}

function buildCategoryBreakdown(jdHits: TaxonomyHit[], resumeSkills: Set<string>): CategoryScore[] {
  const byCategory = new Map<string, TaxonomyHit[]>()
  for (const hit of jdHits) {
    const label = SKILL_CATEGORY_LABELS[hit.entry.category]
    const bucket = byCategory.get(label) ?? []
    bucket.push(hit)
    byCategory.set(label, bucket)
  }

  return [...byCategory.entries()].map(([category, hits]) => {
    const matched = hits.filter((hit) => resumeSkills.has(hit.entry.canonical))
    const missing = hits.filter((hit) => !resumeSkills.has(hit.entry.canonical))
    return {
      category,
      score: Math.round((matched.length / hits.length) * 5),
      matched: matched.map((hit) => hit.entry.canonical),
      missing: missing.map((hit) => hit.entry.canonical),
    }
  })
}

function buildNotes(atsScore: number, matched: TaxonomyHit[], missing: TaxonomyHit[]): string[] {
  const notes: string[] = []

  if (matched.length > 0) {
    const top = matched
      .slice(0, 3)
      .map((hit) => hit.entry.canonical)
      .join(', ')
    notes.push(`Strongest overlap: ${top} — these appear most often in the job description and exist in your Master Resume.`)
  }

  if (missing.length > 0) {
    const top = missing
      .slice(0, 3)
      .map((hit) => hit.entry.canonical)
      .join(', ')
    notes.push(`Largest gaps: ${top} — the job description emphasizes these but your Master Resume doesn't mention them.`)
  }

  if (atsScore >= 75) {
    notes.push('High keyword coverage — an ATS keyword filter is unlikely to screen this profile out.')
  } else if (atsScore >= 45) {
    notes.push('Moderate keyword coverage — review the gaps above; add only skills you genuinely have to the Master Resume.')
  } else {
    notes.push('Low keyword coverage — this role may target a different stack than your Master Resume documents.')
  }

  return notes
}
