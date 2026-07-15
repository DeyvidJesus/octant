/**
 * The Master Resume is the single source of truth of CareerOS.
 * Every other artifact (tailored resumes, analyses, interview prep) is
 * derived from it — never the other way around.
 *
 * The reusable units (accomplishments, skills, STAR stories) are first-class,
 * tagged entities so generators can *select and rank* real facts rather than
 * rewrite prose. Everything is stored exactly once.
 */
export interface MasterResume {
  personal: PersonalInfo
  summary: string
  goals: string
  values: string[]
  experience: ExperienceEntry[]
  projects: ProjectEntry[]
  skills: Skill[]
  stories: StarStory[]
  certifications: Certification[]
  education: Education[]
  publications: Publication[]
  learning: LearningEntry[]
  portfolio: PortfolioAsset[]
  languages: Language[]
  updatedAt: string // ISO — analyses compare against it for staleness
}

export interface PersonalInfo {
  name: string
  role: string
  location: string
  email?: string
  phone?: string
  website?: string
  github?: string
  linkedin?: string
  timezone?: string
  workAuthorization?: string
}

export interface LabeledLink {
  label: string
  url: string
}

/** The atomic, reusable resume unit: one achievement, tagged for selection. */
export interface Accomplishment {
  id: string
  text: string
  /** Canonical skills demonstrated — used to rank relevance to a job. */
  skills: string[]
  /** Quantified outcome, e.g. "improved LCP 40%". */
  metric?: string
  keywords: string[]
}

export interface ExperienceEntry {
  id: string
  company: string
  role: string
  duration: string
  location?: string
  accomplishments: Accomplishment[]
}

export interface ProjectEntry {
  id: string
  name: string
  tech: string[]
  description: string
  url?: string
  accomplishments: Accomplishment[]
}

export interface Skill {
  id: string
  canonical: string
  /** User-facing grouping label, e.g. "Frontend". */
  category: string
  proficiency?: 1 | 2 | 3 | 4 | 5
  yearsUsed?: number
  lastUsedYear?: number
  favorite?: boolean
}

/** Powers behavioral interview prep AND can seed resume accomplishments. */
export interface StarStory {
  id: string
  title: string
  situation: string
  task: string
  action: string
  result: string
  skills: string[]
  /** Behavioral competencies, e.g. "leadership", "conflict resolution". */
  competencies: string[]
  /** Optional link to the experience where it happened. */
  experienceId?: string
  tags: string[]
}

export interface Certification {
  id: string
  name: string
  issuer: string
  issuedAt?: string
  expiresAt?: string
  credentialId?: string
  url?: string
}

export interface Education {
  id: string
  institution: string
  degree: string
  field: string
  start?: string
  end?: string
  notes?: string
}

export interface Publication {
  id: string
  title: string
  venue: string
  date?: string
  url?: string
  description?: string
}

/** Learning history — also the basis for future learning-ROI analysis. */
export interface LearningEntry {
  id: string
  title: string
  provider: string
  completedAt?: string
  skills: string[]
  url?: string
  notes?: string
}

export type PortfolioAssetType = 'repo' | 'live' | 'writeup' | 'talk' | 'other'

export interface PortfolioAsset {
  id: string
  title: string
  type: PortfolioAssetType
  url: string
  description?: string
  tags: string[]
}

export interface Language {
  id: string
  name: string
  level: string
}
