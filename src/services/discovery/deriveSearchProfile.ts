import type { SeniorityLevel } from '@/types/analysis'
import type { WorkMode } from '@/types/job'
import type { CareerKnowledgeBase } from '@/types/resume'
import type { DiscoveryPrefs } from '@/types/discovery'
import { DEFAULT_SEARCH_PROFILE, type SearchProfile } from '@/types/searchProfile'

/** Max technologies seeded from the Master Resume so a strategy prompt stays focused. */
const MAX_DERIVED_TECHNOLOGIES = 12

function splitCsv(value: string | undefined): string[] {
  return (value ?? '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
}

function parseSeniority(text: string): SeniorityLevel {
  const t = text.toLowerCase()
  if (/\b(staff|principal)\b/.test(t)) return 'staff'
  if (/\b(lead|head)\b/.test(t)) return 'lead'
  if (/\b(senior|sr\.?)\b/.test(t)) return 'senior'
  if (/\b(junior|jr\.?|entry|trainee|intern)\b/.test(t)) return 'junior'
  if (/\b(mid|pleno|intermediate)\b/.test(t)) return 'mid'
  return 'unknown'
}

function parseWorkModes(texts: Array<string | undefined>): WorkMode[] {
  const joined = texts.filter(Boolean).join(' ').toLowerCase()
  const modes: WorkMode[] = []
  if (/remote|remoto/.test(joined)) modes.push('remote')
  if (/hybrid|h[íi]brido/.test(joined)) modes.push('hybrid')
  if (/on-?site|presencial|in office|office-based/.test(joined)) modes.push('onsite')
  return modes
}

/** Highest-signal skills first: favourites, then by proficiency desc, capped. */
function topTechnologies(kb: CareerKnowledgeBase): string[] {
  return [...kb.skills]
    .sort((a, b) => {
      const fav = Number(Boolean(b.favorite)) - Number(Boolean(a.favorite))
      if (fav !== 0) return fav
      return (b.proficiency ?? 0) - (a.proficiency ?? 0)
    })
    .map((skill) => skill.canonical)
    .filter(Boolean)
    .slice(0, MAX_DERIVED_TECHNOLOGIES)
}

/**
 * Builds an initial SearchProfile from the Master Resume, migrating any legacy free-text
 * DiscoveryPrefs. Used to seed a brand-new `search_profiles` row so discovery is useful immediately.
 */
export function deriveSearchProfile(
  kb: CareerKnowledgeBase,
  legacy?: DiscoveryPrefs,
): SearchProfile {
  const role = kb.profile.personal.role?.trim() ?? ''
  const location = kb.profile.personal.location?.trim() ?? ''

  const legacyRoles = splitCsv(legacy?.targetRoles)
  const legacyRegions = splitCsv(legacy?.regions)

  return {
    targetRoles: legacyRoles.length ? legacyRoles : role ? [role] : [],
    seniority:
      legacy?.seniority && parseSeniority(legacy.seniority) !== 'unknown'
        ? parseSeniority(legacy.seniority)
        : parseSeniority(role),
    technologies: topTechnologies(kb),
    locations: legacyRegions.length ? legacyRegions : location ? [location] : [],
    workModes: parseWorkModes([legacy?.regions, kb.profile.careerDirection, ...kb.profile.workPreferences]),
    languages: kb.profile.languages.map((language) => language.name).filter(Boolean),
    salaryFloor: undefined,
    salaryCurrency: DEFAULT_SEARCH_PROFILE.salaryCurrency,
    includeKeywords: [],
    excludeKeywords: [],
    extraInstructions: legacy?.extraInstructions?.trim() ?? '',
  }
}

/**
 * The profile the pipeline actually runs on: the user's stored profile with any empty field filled
 * from the resume-derived defaults. Stored non-empty values always win.
 */
export function resolveSearchProfile(
  stored: SearchProfile | null,
  kb: CareerKnowledgeBase,
): SearchProfile {
  const derived = deriveSearchProfile(kb)
  if (!stored) return derived
  return {
    targetRoles: stored.targetRoles.length ? stored.targetRoles : derived.targetRoles,
    seniority: stored.seniority !== 'unknown' ? stored.seniority : derived.seniority,
    technologies: stored.technologies.length ? stored.technologies : derived.technologies,
    locations: stored.locations.length ? stored.locations : derived.locations,
    workModes: stored.workModes.length ? stored.workModes : derived.workModes,
    languages: stored.languages.length ? stored.languages : derived.languages,
    salaryFloor: stored.salaryFloor ?? derived.salaryFloor,
    salaryCurrency: stored.salaryCurrency ?? derived.salaryCurrency,
    includeKeywords: stored.includeKeywords,
    excludeKeywords: stored.excludeKeywords,
    extraInstructions: stored.extraInstructions.trim() || derived.extraInstructions,
  }
}
