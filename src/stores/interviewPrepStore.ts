import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { appStorage } from '@/services/storage/zustandStorage'
import { STORAGE_KEYS } from '@/services/storage/types'
import { nowIso } from '@/utils/dates'
import { createId } from '@/utils/id'

export type InterviewQuestionStatus = 'not_started' | 'practicing' | 'mastered'
export type QuestionConfidence = 'low' | 'medium' | 'high'
export type WeakTopicStatus = 'weak' | 'improving' | 'comfortable'

export interface InterviewQuestionProgress {
  questionId: string
  jobId?: string
  status: InterviewQuestionStatus
  confidence?: QuestionConfidence
  updatedAt: string
}

export interface WeakTopicProgress {
  topic: string
  technology?: string
  status: WeakTopicStatus
  updatedAt: string
}

export interface MockInterviewAnswer {
  id: string
  questionId: string
  answer: string
  confidence?: QuestionConfidence
  notes?: string
  recordedAt: string
}

export interface MockInterviewSession {
  id: string
  jobId?: string
  title?: string
  questionIds: string[]
  answers: MockInterviewAnswer[]
  score?: number
  notes?: string
  startedAt: string
  completedAt?: string
  updatedAt: string
}

interface InterviewPrepState {
  selectedJobId: string | null
  questionProgress: Record<string, InterviewQuestionProgress>
  weakTopics: Record<string, WeakTopicProgress>
  mockInterviewSessions: Record<string, MockInterviewSession>
  setSelectedJobId: (jobId: string | null) => void
  setQuestionStatus: (questionId: string, status: InterviewQuestionStatus, jobId?: string) => void
  setQuestionConfidence: (questionId: string, confidence: QuestionConfidence, jobId?: string) => void
  setWeakTopicStatus: (topic: string, status: WeakTopicStatus, technology?: string) => void
  saveMockInterviewSession: (session: Omit<MockInterviewSession, 'id' | 'answers' | 'startedAt' | 'updatedAt'> & Partial<Pick<MockInterviewSession, 'id' | 'answers' | 'startedAt' | 'updatedAt'>>) => string
  recordMockAnswer: (sessionId: string, answer: Omit<MockInterviewAnswer, 'id' | 'recordedAt'> & Partial<Pick<MockInterviewAnswer, 'id' | 'recordedAt'>>) => void
  clearInterviewPrepForJob: (jobId: string) => void
}

function upsertQuestionProgress(
  existing: InterviewQuestionProgress | undefined,
  questionId: string,
  patch: Partial<InterviewQuestionProgress>,
): InterviewQuestionProgress {
  return {
    questionId,
    status: existing?.status ?? 'not_started',
    ...existing,
    ...patch,
    updatedAt: nowIso(),
  }
}

export const useInterviewPrepStore = create<InterviewPrepState>()(
  persist(
    (set, get) => ({
      selectedJobId: null,
      questionProgress: {},
      weakTopics: {},
      mockInterviewSessions: {},

      setSelectedJobId: (jobId) => set({ selectedJobId: jobId }),

      setQuestionStatus: (questionId, status, jobId) =>
        set((state) => ({
          questionProgress: {
            ...state.questionProgress,
            [questionId]: upsertQuestionProgress(state.questionProgress[questionId], questionId, { jobId, status }),
          },
        })),

      setQuestionConfidence: (questionId, confidence, jobId) =>
        set((state) => ({
          questionProgress: {
            ...state.questionProgress,
            [questionId]: upsertQuestionProgress(state.questionProgress[questionId], questionId, { jobId, confidence }),
          },
        })),

      setWeakTopicStatus: (topic, status, technology) =>
        set((state) => {
          const key = technology ? `${technology}:${topic}` : topic
          return {
            weakTopics: {
              ...state.weakTopics,
              [key]: { topic, technology, status, updatedAt: nowIso() },
            },
          }
        }),

      saveMockInterviewSession: (session) => {
        const id = session.id ?? createId()
        const timestamp = nowIso()
        set((state) => ({
          mockInterviewSessions: {
            ...state.mockInterviewSessions,
            [id]: {
              answers: [],
              startedAt: timestamp,
              ...session,
              id,
              updatedAt: timestamp,
            },
          },
        }))
        return id
      },

      recordMockAnswer: (sessionId, answer) =>
        set((state) => {
          const session = state.mockInterviewSessions[sessionId]
          if (!session) return state

          const id = answer.id ?? createId()
          const recordedAt = answer.recordedAt ?? nowIso()
          const nextAnswer = { ...answer, id, recordedAt }
          const answers = session.answers.some((existing) => existing.id === id)
            ? session.answers.map((existing) => (existing.id === id ? nextAnswer : existing))
            : [...session.answers, nextAnswer]

          return {
            mockInterviewSessions: {
              ...state.mockInterviewSessions,
              [sessionId]: { ...session, answers, updatedAt: nowIso() },
            },
          }
        }),

      clearInterviewPrepForJob: (jobId) =>
        set((state) => {
          const questionProgress = Object.fromEntries(
            Object.entries(state.questionProgress).filter(([, progress]) => progress.jobId !== jobId),
          )
          const mockInterviewSessions = Object.fromEntries(
            Object.entries(state.mockInterviewSessions).filter(([, session]) => session.jobId !== jobId),
          )

          return {
            selectedJobId: get().selectedJobId === jobId ? null : state.selectedJobId,
            questionProgress,
            mockInterviewSessions,
          }
        }),
    }),
    {
      name: STORAGE_KEYS.interviewPrep,
      storage: appStorage,
      version: 1,
    },
  ),
)
