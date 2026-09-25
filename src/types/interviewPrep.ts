// Shared Interview Prep types; import from here rather than redeclaring them.

/** The three readiness categories surfaced on the dashboard. */
export type InterviewQuestionCategory = 'technical' | 'behavioral' | 'architecture'

export type PrepDifficulty = 'beginner' | 'intermediate' | 'advanced'

/** Relevance to the selected job, used for ordering; `resume-core` when there is no JD signal. */
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

/** Question plus user progress, denormalized so the dashboard needn't re-run the generator. */
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

/** One `user_skills` row per (user, skill); `mastery` is a running 0-100 blend of AI answer scores. */
export interface UserSkill {
  skill: string
  category: InterviewQuestionCategory
  mastery: number
  attempts: number
  lastScoredAt?: string
}
