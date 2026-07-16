import type { LabeledLink } from './resume'

/**
 * A tailored resume: a *selection and ordering* of Master Resume content for
 * one specific job. The generator is deterministic — it may prioritize,
 * reorder, emphasize, and omit, but it cannot write a single word of its own.
 * Every content item carries the id of the Master Resume entity it came from;
 * that traceability IS the anti-invention guarantee.
 */
export interface TailoredResume {
  jobId: string
  generatedAt: string
  /** Master Resume updatedAt at generation time — staleness detection. */
  resumeUpdatedAt: string
  header: TailoredHeader
  summary: string
  skillGroups: TailoredSkillGroup[]
  experience: TailoredExperience[]
  projects: TailoredProject[]
  education: TailoredEducation[]
  certifications: TailoredCertification[]
  languages: TailoredLanguage[]
}

export interface TailoredHeader {
  name: string
  role: string
  location: string
  email?: string
  phone?: string
  links: LabeledLink[]
}

export interface TailoredSkillGroup {
  category: string
  skills: Array<{
    canonical: string
    /** Named in the job description — rendered with emphasis, listed first. */
    matched: boolean
  }>
}

/** One selectable resume line, traceable to its source accomplishment. */
export interface TailoredBullet {
  accomplishmentId: string
  text: string
  metric?: string
  /** Raw relevance to this job (JD-skill weight overlap). Drives ordering. */
  relevance: number
  /** User- or generator-controlled inclusion; excluded bullets don't render or export. */
  included: boolean
}

export interface TailoredExperience {
  experienceId: string
  company: string
  role: string
  duration: string
  location?: string
  bullets: TailoredBullet[]
}

export interface TailoredProject {
  projectId: string
  name: string
  tech: string[]
  url?: string
  description: string
  relevance: number
  included: boolean
  bullets: TailoredBullet[]
}

export interface TailoredEducation {
  educationId: string
  institution: string
  degree: string
  field: string
  period?: string
}

export interface TailoredCertification {
  certificationId: string
  name: string
  issuer: string
}

export interface TailoredLanguage {
  languageId: string
  name: string
  level: string
}
