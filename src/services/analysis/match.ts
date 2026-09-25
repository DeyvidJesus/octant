import type { CategoryScore, MatchReport } from '@/types/analysis'
import type { MasterResume } from '@/types/resume'
import { SKILL_CATEGORY_LABELS } from '@/constants/skillTaxonomy'
import { extractSkills, type TaxonomyHit } from './extract'

/** Canonical skills the resume can truthfully claim, from skill lists, project tech, and bullet text. */
export function collectResumeSkills(resume: MasterResume): Set<string> {
  const explicitTerms = [
    ...resume.skills.map((skill) => skill.canonical),
    ...resume.projects.flatMap((project) => project.tech),
    ...resume.experience.flatMap((entry) => entry.accomplishments.flatMap((a) => a.skills)),
    ...resume.projects.flatMap((project) => project.accomplishments.flatMap((a) => a.skills)),
  ].join('\n')

  // Factual fields only; career goals must never contribute claimable skills.
  const narrativeText = [
    resume.summary,
    resume.personal.location,
    resume.personal.role,
    ...resume.experience.flatMap((entry) => entry.accomplishments.map((a) => a.text)),
    ...resume.projects.flatMap((project) => [project.description, ...project.accomplishments.map((a) => a.text)]),
  ].join('\n')

  const canonical = new Set<string>()
  for (const hit of extractSkills(`${explicitTerms}\n${narrativeText}`)) {
    canonical.add(hit.entry.canonical)
  }
  return canonical
}

/** `matched` is a strict intersection, so no analysis claims experience the resume lacks. */
export function buildMatchReport(jdHits: TaxonomyHit[], resumeSkills: Set<string>): MatchReport {
  const matchedHits = jdHits.filter((hit) => resumeSkills.has(hit.entry.canonical))
  const missingHits = jdHits.filter((hit) => !resumeSkills.has(hit.entry.canonical))

  // Required skills count double so "nice to have" keywords don't dilute the score.
  const totalWeight = jdHits.reduce((sum, hit) => sum + weightOf(hit), 0)
  const matchedWeight = matchedHits.reduce((sum, hit) => sum + weightOf(hit), 0)
  const atsScore = totalWeight === 0 ? 0 : Math.round((matchedWeight / totalWeight) * 100)

  return {
    atsScore,
    matched: matchedHits.map((hit) => hit.entry.canonical),
    missing: missingHits.map((hit) => hit.entry.canonical),
    categoryBreakdown: buildCategoryBreakdown(jdHits, resumeSkills),
    notes: buildNotes(atsScore, matchedHits, missingHits),
  }
}

function weightOf(hit: TaxonomyHit): number {
  return hit.importance === 'required' ? hit.count * 2 : hit.count
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

  const missingRequired = missing.filter((hit) => hit.importance === 'required')
  const missingPreferred = missing.filter((hit) => hit.importance === 'preferred')

  if (missingRequired.length > 0) {
    const top = missingRequired
      .slice(0, 3)
      .map((hit) => hit.entry.canonical)
      .join(', ')
    notes.push(`Missing must-haves: ${top} — the job frames these as requirements and your Master Resume doesn't mention them. Highest-priority gaps.`)
  }

  if (missingPreferred.length > 0) {
    const top = missingPreferred
      .slice(0, 3)
      .map((hit) => hit.entry.canonical)
      .join(', ')
    notes.push(`Missing nice-to-haves: ${top} — optional in this posting, so lower priority.`)
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
