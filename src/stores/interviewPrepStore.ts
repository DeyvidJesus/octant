import { create } from 'zustand'

export type InterviewQuestionCategory = 'technical' | 'behavioral' | 'architecture'

export type InterviewQuestionReviewStatus =
  | 'mastered'
  | 'need_review'
  | 'review_tomorrow'
  | 'review_next_week'
  | 'in_progress'
  | 'not_started'

export interface InterviewPrepQuestion {
  id: string
  prompt: string
  category: InterviewQuestionCategory
  mastered?: boolean
  confidence?: number
  status?: InterviewQuestionReviewStatus
  topic?: string
}

interface InterviewPrepState {
  questions: InterviewPrepQuestion[]
  setQuestions: (questions: InterviewPrepQuestion[]) => void
}

export const useInterviewPrepStore = create<InterviewPrepState>()((set) => ({
  questions: [],
  setQuestions: (questions) => set({ questions }),
}))
