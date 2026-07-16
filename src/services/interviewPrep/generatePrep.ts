import type { JobAnalysis } from '@/types/analysis'
import type { JobOpportunity } from '@/types/job'
import type { CareerKnowledgeBase } from '@/types/resume'

export type PrepLevel = 'beginner' | 'intermediate' | 'advanced'
export type PrepPriority = 'required-missing' | 'required-matched' | 'preferred' | 'resume-core'

export interface PrepQuestion {
  id: string
  technology: string
  level: PrepLevel
  question: string
  priority: PrepPriority
}

export interface PrepJobContext {
  company: string
  role: string
  detectedStack: string[]
  missingRequirements: string[]
  atsScore: number
}

export interface InterviewPrepTopic {
  technology: string
  priority: PrepPriority
  questions: PrepQuestion[]
}

export interface InterviewPrepPlan {
  topics: InterviewPrepTopic[]
  jobContext?: PrepJobContext
}

interface TechnologyCandidate {
  canonical: string
  priority: PrepPriority
  firstSeen: number
}

const PRIORITY_RANK: Record<PrepPriority, number> = {
  'required-missing': 0,
  'required-matched': 1,
  preferred: 2,
  'resume-core': 3,
}

const LEVELS: PrepLevel[] = ['beginner', 'intermediate', 'advanced']

export function generatePrep(
  resume: CareerKnowledgeBase,
  job?: JobOpportunity,
  analysis?: JobAnalysis,
): InterviewPrepPlan {
  const technologies = rankTechnologies(resume, analysis)
  const topics = technologies.map((technology) => ({
    technology: technology.canonical,
    priority: technology.priority,
    questions: LEVELS.map((level) => buildQuestion(technology.canonical, level, technology.priority)),
  }))

  return {
    topics,
    ...(job && analysis ? { jobContext: buildJobContext(job, analysis) } : {}),
  }
}

function rankTechnologies(resume: CareerKnowledgeBase, analysis?: JobAnalysis): TechnologyCandidate[] {
  const byKey = new Map<string, TechnologyCandidate>()
  let sequence = 0

  const add = (canonical: string, priority: PrepPriority) => {
    const normalized = canonical.trim()
    if (!normalized) return

    const key = normalized.toLocaleLowerCase()
    const existing = byKey.get(key)
    if (!existing) {
      byKey.set(key, { canonical: normalized, priority, firstSeen: sequence++ })
      return
    }

    if (PRIORITY_RANK[priority] < PRIORITY_RANK[existing.priority]) {
      existing.priority = priority
    }
  }

  const requiredMissing = new Set((analysis?.match.missing ?? []).map(normalizeKey))
  const requiredMatched = new Set((analysis?.match.matched ?? []).map(normalizeKey))

  for (const skill of analysis?.detectedStack ?? []) {
    const key = normalizeKey(skill.canonical)
    if (skill.importance === 'required' && requiredMissing.has(key)) add(skill.canonical, 'required-missing')
  }

  for (const missing of analysis?.match.missing ?? []) {
    const detected = analysis?.detectedStack.find((skill) => normalizeKey(skill.canonical) === normalizeKey(missing))
    const isPreferred = detected?.importance === 'preferred'
    add(detected?.canonical ?? missing, isPreferred ? 'preferred' : 'required-missing')
  }

  for (const skill of analysis?.detectedStack ?? []) {
    if (skill.importance === 'required' && (skill.inResume || requiredMatched.has(normalizeKey(skill.canonical)))) {
      add(skill.canonical, 'required-matched')
    }
  }

  for (const matched of analysis?.match.matched ?? []) {
    const detected = analysis?.detectedStack.find((skill) => normalizeKey(skill.canonical) === normalizeKey(matched))
    if (!detected || detected.importance === 'required') add(detected?.canonical ?? matched, 'required-matched')
  }

  for (const skill of analysis?.detectedStack ?? []) {
    if (skill.importance === 'preferred') add(skill.canonical, 'preferred')
  }

  for (const skill of resume.skills) {
    add(skill.canonical, 'resume-core')
  }

  return [...byKey.values()].sort((a, b) => {
    const priorityDelta = PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority]
    if (priorityDelta !== 0) return priorityDelta
    return a.canonical.localeCompare(b.canonical, undefined, { sensitivity: 'base' }) || a.firstSeen - b.firstSeen
  })
}

function buildQuestion(technology: string, level: PrepLevel, priority: PrepPriority): PrepQuestion {
  const prompts: Record<PrepLevel, string> = {
    beginner: `Explain the core purpose of ${technology} and when you would choose it in a production system.`,
    intermediate: `Describe a practical ${technology} implementation challenge you have solved or would expect in this role.`,
    advanced: `How would you evaluate tradeoffs, failure modes, and scaling concerns for ${technology} in a business-critical system?`,
  }

  return {
    id: `${slugify(technology)}-${level}`,
    technology,
    level,
    priority,
    question: prompts[level],
  }
}

function buildJobContext(job: JobOpportunity, analysis: JobAnalysis): PrepJobContext {
  return {
    company: job.company,
    role: job.role,
    detectedStack: analysis.detectedStack.map((skill) => skill.canonical),
    missingRequirements: analysis.match.missing,
    atsScore: analysis.match.atsScore,
  }
}

function normalizeKey(value: string): string {
  return value.trim().toLocaleLowerCase()
}

function slugify(value: string): string {
  return normalizeKey(value).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

