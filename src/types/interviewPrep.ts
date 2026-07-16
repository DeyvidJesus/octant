export type InterviewPrepStatus =
  | 'unknown'
  | 'need_review'
  | 'mastered'
  | 'review_tomorrow'
  | 'review_next_week'

export type InterviewQuestionDifficulty = 'beginner' | 'intermediate' | 'advanced'

export type InterviewQuestionCategory =
  | 'technical'
  | 'behavioral'
  | 'architecture'
  | 'system_design'
  | 'product'
  | 'problem_solving'

export interface InterviewPrepQuestion {
  id: string
  /** Optional stack/topic tag, e.g. React, Node.js, PostgreSQL, or AWS. */
  technology?: string
  category: InterviewQuestionCategory
  difficulty: InterviewQuestionDifficulty
  question: string
  expectedAnswer: string
  whyInterviewersAsk: string
  commonMistakes: string[]
  followUps: string[]
}

export interface InterviewPrepProgress {
  questionId: string
  status: InterviewPrepStatus
  /** User-rated readiness for this question, stored as a 0-100 percentage. */
  confidence: number
  lastReviewedAt?: string
  nextReviewAt?: string
  notes?: string
}

export interface MockInterviewAnswerReview {
  questionId: string
  userAnswer: string
  idealAnswer: string
  comparison: string
  /** Per-answer score, stored as a 0-100 percentage. */
  score: number
}

export interface MockInterviewSession {
  id: string
  /** Optional link to a saved job/application target. */
  jobId?: string
  company: string
  createdAt: string
  questions: InterviewPrepQuestion[]
  answers: MockInterviewAnswerReview[]
  /** Overall session score, stored as a 0-100 percentage. */
  score: number
}

export interface InterviewPrepDailyStudyItem {
  id: string
  date: string
  questionIds: string[]
  topics: string[]
  completed: boolean
}

export interface InterviewPrepPlan {
  id: string
  createdAt: string
  dailyStudyItems: InterviewPrepDailyStudyItem[]
  weakTopics: string[]
  reviewTopics: string[]
  /** Overall readiness score, stored as a 0-100 percentage. */
  readinessPercentage: number
  /** Topic-level readiness scores, each stored as a 0-100 percentage. */
  topicReadinessPercentages: Record<string, number>
}
