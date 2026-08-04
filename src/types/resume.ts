/**
 * CareerKnowledgeBase is the persisted source of truth for Octant. A
 * ResumeProjection is a deterministic, read-only view used by legacy resume
 * consumers while they transition to the knowledge-base collections.
 */

export type FactStatus = 'confirmed' | 'needs_review' | 'todo'

export type FactType =
  | 'situation' | 'task' | 'responsibility' | 'action' | 'challenge'
  | 'achievement' | 'result' | 'business_value' | 'product_impact'
  | 'leadership' | 'mentoring' | 'communication' | 'stakeholder_interaction'
  | 'client_interaction' | 'problem_solving' | 'failure' | 'lesson'
  | 'technical_capability'

export interface Provenance {
  source: string
  excerpt: string
  notes?: string
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

export interface CareerProfile {
  personal: PersonalInfo
  summary: string
  careerDirection: string
  philosophy?: string
  values: string[]
  workPreferences: string[]
  languages: Language[]
}

export interface Organization {
  id: string
  name: string
  type?: 'employer' | 'client' | 'personal' | 'other'
  provenance: Provenance
}

export interface Role {
  id: string
  organizationId: string
  title: string
  period: string
  location?: string
  provenance: Provenance
}

export type InitiativeType = 'employment_project' | 'freelance_engagement' | 'portfolio_project' | 'other'

export interface Initiative {
  id: string
  name: string
  type: InitiativeType
  description?: string
  roleIds: string[]
  technologySkillIds: string[]
  url?: string
  provenance: Provenance
}

export interface KnowledgeSkill {
  id: string
  canonical: string
  category: string
  proficiency?: 1 | 2 | 3 | 4 | 5
  yearsUsed?: number
  lastUsedYear?: number
  favorite?: boolean
  evidenceFactIds: string[]
  provenance: Provenance
}

export interface CareerFact {
  id: string
  type: FactType
  statement: string
  status: FactStatus
  roleIds: string[]
  initiativeIds: string[]
  skillIds: string[]
  metricIds: string[]
  tags: string[]
  occurredAt?: string
  provenance: Provenance
}

export interface Metric {
  id: string
  statement: string
  kind: 'numeric' | 'qualitative'
  value?: number
  unit?: string
  baseline?: string
  factIds: string[]
  status: FactStatus
  provenance: Provenance
}

export interface TechnicalDecision {
  id: string
  context: string
  selectedApproach: string
  rationale?: string
  optionsConsidered: string[]
  tradeoffs: string[]
  outcome?: string
  roleIds: string[]
  initiativeIds: string[]
  factIds: string[]
  status: FactStatus
  provenance: Provenance
}

export interface KnowledgeStory {
  id: string
  title: string
  situationFactIds: string[]
  taskFactIds: string[]
  actionFactIds: string[]
  resultFactIds: string[]
  skillIds: string[]
  competencies: string[]
  roleIds: string[]
  tags: string[]
  status: FactStatus
  provenance: Provenance
}

export type CredentialType = 'certification' | 'education'

export interface Credential {
  id: string
  type: CredentialType
  name: string
  issuer?: string
  field?: string
  start?: string
  end?: string
  issuedAt?: string
  expiresAt?: string
  credentialId?: string
  url?: string
  notes?: string
  status: FactStatus
  provenance: Provenance
}

export type PortfolioAssetType = 'repo' | 'live' | 'writeup' | 'talk' | 'other'

export interface KnowledgePortfolioAsset {
  id: string
  title: string
  type: PortfolioAssetType
  url?: string
  description?: string
  initiativeIds: string[]
  tags: string[]
  status: FactStatus
  provenance: Provenance
}

export interface KnowledgePublication {
  id: string
  title: string
  venue: string
  date?: string
  url?: string
  description?: string
  status: FactStatus
  provenance: Provenance
}

export interface KnowledgeLearningEntry {
  id: string
  title: string
  provider: string
  completedAt?: string
  skillIds: string[]
  url?: string
  notes?: string
  status: FactStatus
  provenance: Provenance
}

export interface Language {
  id: string
  name: string
  level: string
  provenance?: Provenance
}

export interface UnclassifiedFact {
  id: string
  rawText: string
  source: string
  reason: string
  status: 'needs_review'
}

export interface CareerKnowledgeBase {
  schemaVersion: 3
  profile: CareerProfile
  organizations: Organization[]
  roles: Role[]
  initiatives: Initiative[]
  skills: KnowledgeSkill[]
  facts: CareerFact[]
  metrics: Metric[]
  technicalDecisions: TechnicalDecision[]
  stories: KnowledgeStory[]
  credentials: Credential[]
  portfolioAssets: KnowledgePortfolioAsset[]
  publications: KnowledgePublication[]
  learning: KnowledgeLearningEntry[]
  unclassifiedFacts: UnclassifiedFact[]
  updatedAt: string
}

/** A presentation/query view; never persist this shape. */
export interface Accomplishment {
  id: string
  text: string
  skills: string[]
  metric?: string
  keywords: string[]
}

export interface LabeledLink { label: string; url: string }

/** Legacy/read-model types kept for existing consumers and temporary editor compatibility. */
export interface Skill {
  id: string
  canonical: string
  category: string
  proficiency?: 1 | 2 | 3 | 4 | 5
  yearsUsed?: number
  lastUsedYear?: number
  favorite?: boolean
}

export interface StarStory {
  id: string
  title: string
  situation: string
  task: string
  action: string
  result: string
  skills: string[]
  competencies: string[]
  experienceId?: string
  tags: string[]
}

export interface PortfolioAsset {
  id: string
  title: string
  type: PortfolioAssetType
  url: string
  description?: string
  tags: string[]
}

export interface Publication {
  id: string
  title: string
  venue: string
  date?: string
  url?: string
  description?: string
}

export interface LearningEntry {
  id: string
  title: string
  provider: string
  completedAt?: string
  skills: string[]
  url?: string
  notes?: string
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

export interface Certification { id: string; name: string; issuer: string; issuedAt?: string; expiresAt?: string; credentialId?: string; url?: string }
export interface Education { id: string; institution: string; degree: string; field: string; start?: string; end?: string; notes?: string }

export interface ResumeProjection {
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
  updatedAt: string
}

/** @deprecated Use CareerKnowledgeBase for persisted data. */
export type MasterResume = ResumeProjection
