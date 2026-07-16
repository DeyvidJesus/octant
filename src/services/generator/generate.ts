import type { JobAnalysis } from '@/types/analysis'
import type { MasterResume, Skill } from '@/types/resume'
import type {
  TailoredBullet,
  TailoredExperience,
  TailoredProject,
  TailoredResume,
  TailoredSkillGroup,
} from '@/types/generator'
import { nowIso } from '@/utils/dates'
import { buildJdWeights, scoreAccomplishment, scoreText, type JdWeights } from './score'

/**
 * The deterministic tailoring engine. Selection, ranking, and reordering of
 * real Master Resume content — never generation. Same inputs, same output.
 *
 * Selection defaults tuned for a one-page, ATS-parseable resume:
 * recruiters skim; every included line should either match the job or carry
 * a metric.
 */

/** Bullets kept per experience — top-relevance first. */
const MAX_BULLETS_PER_EXPERIENCE = 4
/** Even for an unrelated job, a role never renders empty. */
const MIN_BULLETS_PER_EXPERIENCE = 2
const MAX_PROJECTS = 2
const MAX_BULLETS_PER_PROJECT = 2
/** Unmatched skills still worth listing (favorites/high proficiency), capped. */
const MAX_UNMATCHED_SKILLS = 8

export function generateTailoredResume(
  resume: MasterResume,
  analysis: JobAnalysis,
): TailoredResume {
  const weights = buildJdWeights(analysis)
  const jdSkills = new Set(analysis.detectedStack.map((skill) => skill.canonical))

  return {
    jobId: analysis.jobId,
    generatedAt: nowIso(),
    resumeUpdatedAt: resume.updatedAt,
    header: buildHeader(resume),
    summary: resume.summary,
    skillGroups: buildSkillGroups(resume.skills, jdSkills),
    experience: resume.experience.map((entry) => buildExperience(entry, weights)),
    projects: buildProjects(resume, weights),
    education: resume.education.map((entry) => ({
      educationId: entry.id,
      institution: entry.institution,
      degree: entry.degree,
      field: entry.field,
      period: [entry.start, entry.end].filter(Boolean).join(' – ') || undefined,
    })),
    certifications: resume.certifications.map((cert) => ({
      certificationId: cert.id,
      name: cert.name,
      issuer: cert.issuer,
    })),
    languages: resume.languages.map((language) => ({
      languageId: language.id,
      name: language.name,
      level: language.level,
    })),
  }
}

function buildHeader(resume: MasterResume): TailoredResume['header'] {
  const { personal } = resume
  const links = [
    personal.github && { label: 'GitHub', url: personal.github },
    personal.linkedin && { label: 'LinkedIn', url: personal.linkedin },
    personal.website && { label: 'Website', url: personal.website },
  ].filter((link): link is { label: string; url: string } => Boolean(link))

  return {
    name: personal.name,
    role: personal.role,
    location: personal.location,
    email: personal.email,
    phone: personal.phone,
    links,
  }
}

/**
 * Skills reordered for the recruiter's 6-second scan: categories with the
 * most JD matches first; within a category, matched skills first. Unmatched
 * skills are capped so tailoring actually *removes* noise.
 */
function buildSkillGroups(skills: Skill[], jdSkills: Set<string>): TailoredSkillGroup[] {
  const byCategory = new Map<string, Skill[]>()
  for (const skill of skills) {
    const bucket = byCategory.get(skill.category) ?? []
    bucket.push(skill)
    byCategory.set(skill.category, bucket)
  }

  let unmatchedBudget = MAX_UNMATCHED_SKILLS
  const groups: Array<{ group: TailoredSkillGroup; matchedCount: number }> = []

  for (const [category, categorySkills] of byCategory) {
    const matched = categorySkills.filter((skill) => jdSkills.has(skill.canonical))
    const unmatched = categorySkills
      .filter((skill) => !jdSkills.has(skill.canonical))
      .sort((a, b) => (b.proficiency ?? 0) - (a.proficiency ?? 0))

    const keptUnmatched = unmatched.slice(0, unmatchedBudget)
    unmatchedBudget -= keptUnmatched.length

    const entries = [
      ...matched.map((skill) => ({ canonical: skill.canonical, matched: true })),
      ...keptUnmatched.map((skill) => ({ canonical: skill.canonical, matched: false })),
    ]
    if (entries.length > 0) {
      groups.push({ group: { category, skills: entries }, matchedCount: matched.length })
    }
  }

  return groups.sort((a, b) => b.matchedCount - a.matchedCount).map((entry) => entry.group)
}

/**
 * Experiences keep their reverse-chronological order (recruiters expect it);
 * tailoring happens *inside* each role: bullets ranked by relevance, top N
 * included, authored order breaking ties.
 */
function buildExperience(
  entry: MasterResume['experience'][number],
  weights: JdWeights,
): TailoredExperience {
  return {
    experienceId: entry.id,
    company: entry.company,
    role: entry.role,
    duration: entry.duration,
    location: entry.location,
    bullets: selectBullets(entry.accomplishments, weights, MAX_BULLETS_PER_EXPERIENCE, MIN_BULLETS_PER_EXPERIENCE),
  }
}

function selectBullets(
  accomplishments: MasterResume['experience'][number]['accomplishments'],
  weights: JdWeights,
  max: number,
  min: number,
): TailoredBullet[] {
  const ranked = accomplishments
    .map((accomplishment, index) => ({
      accomplishment,
      index,
      relevance: scoreAccomplishment(accomplishment, weights),
    }))
    .sort((a, b) => b.relevance - a.relevance || a.index - b.index)

  return ranked.map(({ accomplishment, relevance }, rank) => ({
    accomplishmentId: accomplishment.id,
    text: accomplishment.text,
    metric: accomplishment.metric,
    relevance,
    // Include the top `max` relevant bullets; keep at least `min` even when
    // nothing matches so the role never renders empty.
    included: rank < max && (relevance > 0 || rank < min),
  }))
}

/** Projects are ranked as a whole (tech + description + bullets); top N included. */
function buildProjects(resume: MasterResume, weights: JdWeights): TailoredProject[] {
  const scored = resume.projects.map((project, index) => {
    const bullets = selectBullets(project.accomplishments, weights, MAX_BULLETS_PER_PROJECT, 0)
    const relevance =
      scoreText([project.name, ...project.tech, project.description].join('\n'), weights) +
      bullets.reduce((sum, bullet) => sum + bullet.relevance, 0)
    return { project, index, relevance, bullets }
  })

  const rankedIds = [...scored]
    .sort((a, b) => b.relevance - a.relevance || a.index - b.index)
    .slice(0, MAX_PROJECTS)
    .map((entry) => entry.project.id)

  // Preserve authored order in the output; ranking only decides inclusion.
  return scored.map(({ project, relevance, bullets }) => ({
    projectId: project.id,
    name: project.name,
    tech: project.tech,
    url: project.url,
    description: project.description,
    relevance,
    included: rankedIds.includes(project.id),
    bullets,
  }))
}
