/**
 * The Master Resume is the single source of truth of CareerOS.
 * Every other artifact (tailored resumes, analyses, interview prep) is
 * derived from it — never the other way around.
 */
export interface MasterResume {
  personal: PersonalInfo
  summary: string
  goals: string
  values: string[]
  experience: ExperienceEntry[]
  projects: ProjectEntry[]
  skills: SkillCategory[]
  updatedAt: string // ISO timestamp — analyses compare against it for staleness
}

export interface PersonalInfo {
  name: string
  role: string
  location: string
  english: string
  experienceLabel: string
  email?: string
  links?: LabeledLink[]
}

export interface ExperienceEntry {
  id: string
  company: string
  role: string
  duration: string
  bullets: string[]
}

export interface ProjectEntry {
  id: string
  name: string
  tech: string[]
  description: string
  bullets: string[]
}

export interface SkillCategory {
  id: string
  label: string
  skills: string[]
}

export interface LabeledLink {
  label: string
  url: string
}
