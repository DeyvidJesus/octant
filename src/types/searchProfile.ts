import type { SeniorityLevel } from './analysis'
import type { WorkMode } from './job'

/** Structured discovery inputs; empty fields fall back to values derived from the Master Resume. */
export interface SearchProfile {
  /** Job titles to target, e.g. ["Software Engineer", "Full Stack Engineer"]. */
  targetRoles: string[]
  /** Desired seniority; 'unknown' means "let the resume/role decide". */
  seniority: SeniorityLevel
  /** Technologies/skills to prioritise in searches. */
  technologies: string[]
  /** Locations / regions, e.g. ["Remote — US", "Europe (LATAM-friendly)"]. */
  locations: string[]
  /** Acceptable work modes. Empty = any. */
  workModes: WorkMode[]
  /** Languages the user works in, e.g. ["English", "Portuguese"]. */
  languages: string[]
  /** Minimum acceptable salary (annual, in `salaryCurrency`). Undefined = unspecified. */
  salaryFloor?: number
  /** ISO-ish currency code for `salaryFloor`, e.g. "USD". */
  salaryCurrency?: string
  /** Keywords that should appear / must be avoided. */
  includeKeywords: string[]
  excludeKeywords: string[]
  /** Free-text guidance appended to every discovery strategy prompt. */
  extraInstructions: string
}

export const DEFAULT_SEARCH_PROFILE: SearchProfile = {
  targetRoles: [],
  seniority: 'unknown',
  technologies: [],
  locations: [],
  workModes: [],
  languages: [],
  salaryFloor: undefined,
  salaryCurrency: 'USD',
  includeKeywords: [],
  excludeKeywords: [],
  extraInstructions: '',
}

export const SENIORITY_OPTIONS: SeniorityLevel[] = ['unknown', 'junior', 'mid', 'senior', 'staff', 'lead']
export const WORK_MODE_OPTIONS: WorkMode[] = ['remote', 'hybrid', 'onsite']
