/**
 * Single source of truth for the Interview Prep module. Everything else
 * (the deterministic generator, the static question bank, the behavioral set,
 * the store, the page, and the dashboard) imports from here — no local
 * re-declarations of these concepts.
 */

/** The three readiness categories surfaced on the dashboard. */
export type InterviewQuestionCategory = 'technical' | 'behavioral' | 'architecture'

export type PrepDifficulty = 'beginner' | 'intermediate' | 'advanced'

/**
 * How relevant a question is to the selected job, driving ordering. Behavioral
 * and architecture questions default to `resume-core` when there is no JD signal.
 */
export type PrepPriority = 'required-missing' | 'required-matched' | 'preferred' | 'resume-core'

/** A single generated (deterministic) interview question. */
export interface PrepQuestion {
  id: string
  category: InterviewQuestionCategory
  difficulty: PrepDifficulty
  question: string
  /** Stack/topic tag, e.g. React, Authentication, or Leadership. */
  topic?: string
  priority: PrepPriority
  /** Model answer or outline the candidate can study against. */
  expectedAnswer?: string
  whyInterviewersAsk?: string
  commonMistakes?: string[]
  followUps?: string[]
}

export interface InterviewPrepTopic {
  topic: string
  category: InterviewQuestionCategory
  priority: PrepPriority
  questions: PrepQuestion[]
}

export interface PrepJobContext {
  company: string
  role: string
  detectedStack: string[]
  missingRequirements: string[]
  atsScore: number
}

export interface InterviewPrepPlan {
  topics: InterviewPrepTopic[]
  jobContext?: PrepJobContext
}

/** Where a tracked question sits in the user's review cycle. */
export type InterviewPrepStatus =
  | 'not_started'
  | 'in_progress'
  | 'need_review'
  | 'review_tomorrow'
  | 'review_next_week'
  | 'mastered'

/**
 * A question the user has engaged with, merged with their progress. Denormalized
 * so the dashboard can compute readiness without re-running the generator.
 */
export interface TrackedQuestion {
  id: string
  category: InterviewQuestionCategory
  difficulty: PrepDifficulty
  question: string
  topic?: string
  /** User-rated readiness, stored as a 0-100 percentage. */
  confidence: number
  status: InterviewPrepStatus
  mastered: boolean
  notes?: string
  lastReviewedAt?: string
}
