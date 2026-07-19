import { create } from 'zustand'
import type { InterviewQuestionCategory, UserSkill } from '@/types/interviewPrep'
import type { InterviewCoachFeedback } from '@/services/ai/tasks/interviewCoach'
import { blendMastery } from '@/services/interviewPrep/mastery'
import { interviewPrepRepository } from '@/repositories/InterviewPrepRepository'
import { UnauthenticatedError } from '@/repositories/errors'

/**
 * Interview simulation progress. Mastery is per-SKILL and driven by AI answer scores (not manual
 * self-rating): each coached answer is recorded as a `mock_answer` and blended into the skill's
 * mastery in `user_skills`. Replaces the retired per-question self-rating blob.
 */
export interface RecordAnswerInput {
  job: { id: string; company: string; role: string }
  skill: string
  category: InterviewQuestionCategory
  question: string
  answer: string
  score: number
  feedback: InterviewCoachFeedback
}

interface InterviewPrepState {
  /** Per-skill mastery, keyed by skill name. */
  skills: Record<string, UserSkill>
  /** Persists a coached answer and blends its score into the skill's mastery. */
  recordAnswer: (input: RecordAnswerInput) => Promise<UserSkill | null>
  _fetchFromSupabase: () => Promise<void>
}

export const useInterviewPrepStore = create<InterviewPrepState>()((set, get) => {
  // One mock-interview session per job, opened lazily on the first recorded answer.
  let activeInterview: { jobId: string; id: string } | null = null

  return {
    skills: {},

    recordAnswer: async (input) => {
      try {
        if (!activeInterview || activeInterview.jobId !== input.job.id) {
          const id = await interviewPrepRepository.startMockInterview({
            jobId: input.job.id,
            company: input.job.company,
            role: input.job.role,
          })
          activeInterview = { jobId: input.job.id, id }
        }

        await interviewPrepRepository.saveMockAnswer({
          mockInterviewId: activeInterview.id,
          skill: input.skill,
          question: input.question,
          answer: input.answer,
          score: input.score,
          feedback: input.feedback,
        })

        const prev = get().skills[input.skill]
        const blended = blendMastery(prev ? { mastery: prev.mastery, attempts: prev.attempts } : null, input.score)
        const next: UserSkill = {
          skill: input.skill,
          category: input.category,
          mastery: blended.mastery,
          attempts: blended.attempts,
          lastScoredAt: new Date().toISOString(),
        }

        await interviewPrepRepository.upsertSkillMastery({
          skill: next.skill,
          category: next.category,
          mastery: next.mastery,
          attempts: next.attempts,
        })
        set((state) => ({ skills: { ...state.skills, [next.skill]: next } }))
        return next
      } catch (error) {
        if (error instanceof UnauthenticatedError) return null
        console.error('[interviewPrepStore] failed to record answer', error)
        return null
      }
    },

    _fetchFromSupabase: async () => {
      try {
        const skills = await interviewPrepRepository.getUserSkills()
        const map: Record<string, UserSkill> = {}
        for (const skill of skills) map[skill.skill] = skill
        set({ skills: map })
      } catch (error) {
        if (error instanceof UnauthenticatedError) return
        console.error('[interviewPrepStore] failed to load from Supabase', error)
      }
    },
  }
})
