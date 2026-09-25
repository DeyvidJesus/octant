import { z } from 'zod'
import { APPLICATION_STAGES } from '@/constants/applicationStages'

// Read-side guards for the JSONB `data` columns. Rows are written by older app versions and by the
// discovery worker, so the UI must not trust their shape: repair what has a safe default, drop the rest.
// Schemas are loose (unknown keys survive) and check only what the UI would crash on.

const text = z.string()
const textOr = (fallback: string) => z.string().catch(fallback)
const list = <T extends z.ZodType>(item: T) => z.array(item).catch([])
const strings = list(z.string())
const anyList = list(z.unknown())

export const jobSchema = z.looseObject({
  id: text,
  company: text,
  role: text,
  description: textOr(''),
  tags: strings,
  archived: z.boolean().catch(false),
  createdAt: textOr(''),
  workMode: z.enum(['remote', 'hybrid', 'onsite', 'unknown']).catch('unknown'),
  source: z.enum(['manual', 'imported', 'discovered']).catch('manual'),
})

export const applicationSchema = z.looseObject({
  id: text,
  company: text,
  role: text,
  stage: z.enum(APPLICATION_STAGES as [string, ...string[]]).catch('saved'),
  workMode: z.enum(['remote', 'hybrid', 'onsite', 'unknown']).catch('unknown'),
  createdAt: textOr(''),
  updatedAt: textOr(''),
  notes: textOr(''),
  links: anyList,
  events: anyList,
})

export const jobAnalysisSchema = z.looseObject({
  jobId: text,
  analyzerId: textOr('unknown'),
  analyzedAt: textOr(''),
  detectedStack: anyList,
  detectedSeniority: textOr('unknown'),
  seniorityEvidence: strings,
  atsKeywords: strings,
  match: z.looseObject({
    atsScore: z.number().min(0).max(100).catch(0),
    matched: strings,
    missing: strings,
    categoryBreakdown: anyList,
    notes: strings,
  }),
})

export const discoveredCandidateSchema = z.looseObject({
  id: text,
  company: text,
  role: text,
  description: textOr(''),
  sourceNote: textOr(''),
  foundAt: textOr(''),
  workMode: z.enum(['remote', 'hybrid', 'onsite', 'unknown']).catch('unknown'),
  // A malformed nested analysis only loses the score details, not the candidate.
  analysis: jobAnalysisSchema.optional().catch(undefined),
})

export const tailoredResumeSchema = z.looseObject({
  jobId: text,
  generatedAt: textOr(''),
  resumeUpdatedAt: textOr(''),
  summary: textOr(''),
  header: z.looseObject({ name: textOr(''), role: textOr(''), location: textOr(''), links: anyList }),
  skillGroups: anyList,
  experience: anyList,
  projects: anyList,
  education: anyList,
  certifications: anyList,
  languages: anyList,
})

export const organizationSchema = z.looseObject({ id: text, name: textOr('') })
export const roleSchema = z.looseObject({ id: text, organizationId: textOr(''), title: textOr('') })
export const knowledgeSkillSchema = z.looseObject({ id: text, canonical: text, evidenceFactIds: strings })
export const careerFactSchema = z.looseObject({
  id: text,
  statement: textOr(''),
  type: textOr('other'),
  status: z.enum(['confirmed', 'needs_review', 'todo']).catch('needs_review'),
  roleIds: strings,
  initiativeIds: strings,
  skillIds: strings,
  metricIds: strings,
  tags: strings,
})

/** Why a row was dropped, without its content (it may hold personal data). */
export interface RejectedRow {
  index: number
  id?: string
  issues: string[]
}

/**
 * Parses each document, keeping repaired ones and collecting the rejects. `T` is the domain type the
 * schema guards; the schema checks structure, TypeScript stays the source of truth for the shape.
 */
export function parseDocuments<T>(docs: unknown[], schema: z.ZodType): { valid: T[]; rejected: RejectedRow[] } {
  const valid: T[] = []
  const rejected: RejectedRow[] = []
  docs.forEach((doc, index) => {
    const result = schema.safeParse(doc)
    if (result.success) {
      valid.push(result.data as T)
      return
    }
    const id = doc && typeof doc === 'object' && typeof (doc as { id?: unknown }).id === 'string' ? (doc as { id: string }).id : undefined
    rejected.push({ index, id, issues: result.error.issues.map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`) })
  })
  return { valid, rejected }
}
