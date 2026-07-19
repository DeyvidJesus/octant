import type { InterviewQuestionCategory, UserSkill } from '@/types/interviewPrep'
import type { InterviewCoachFeedback } from '@/services/ai/tasks/interviewCoach'
import { supabase } from '@/services/supabase/client'
import { BaseRepository } from './BaseRepository'

interface UserSkillRow {
  skill: string
  category: string
  mastery: number
  attempts: number
  last_scored_at: string | null
}

export interface StartMockInterviewInput {
  jobId?: string
  company?: string
  role?: string
}

export interface SaveMockAnswerInput {
  mockInterviewId: string
  skill: string
  question: string
  answer: string
  score: number
  feedback: InterviewCoachFeedback
}

export interface UpsertSkillInput {
  skill: string
  category: InterviewQuestionCategory
  mastery: number
  attempts: number
}

/**
 * Data-access boundary for the interview simulation: per-skill mastery (`user_skills`) and mock
 * interview sessions/answers (`mock_interviews`, `mock_answers`). RLS-scoped; throws `AppError`
 * subclasses on failure. Resolves the current user from the in-memory session mirror (no per-write
 * `auth.getUser()` round-trip — the Phase 3 pattern this store previously lacked).
 */
export class InterviewPrepRepository extends BaseRepository {
  async getUserSkills(): Promise<UserSkill[]> {
    const userId = this.requireUserId()
    const rows = this.unwrap(
      await supabase
        .from('user_skills')
        .select('skill, category, mastery, attempts, last_scored_at')
        .eq('user_id', userId),
      'load your interview skills',
    ) as UserSkillRow[] | null

    return (rows ?? []).map((row) => ({
      skill: row.skill,
      category: (row.category as InterviewQuestionCategory) || 'technical',
      mastery: row.mastery,
      attempts: row.attempts,
      lastScoredAt: row.last_scored_at ?? undefined,
    }))
  }

  /** Opens a mock-interview session and returns its id. */
  async startMockInterview(input: StartMockInterviewInput): Promise<string> {
    const userId = this.requireUserId()
    const row = this.unwrap(
      await supabase
        .from('mock_interviews')
        .insert({
          user_id: userId,
          job_id: input.jobId ?? null,
          company: input.company ?? null,
          role: input.role ?? null,
        })
        .select('id')
        .single(),
      'start the mock interview',
    ) as { id: string }
    return row.id
  }

  /** Records one answered question with its AI score + feedback. */
  async saveMockAnswer(input: SaveMockAnswerInput): Promise<void> {
    const userId = this.requireUserId()
    this.unwrap(
      await supabase.from('mock_answers').insert({
        user_id: userId,
        mock_interview_id: input.mockInterviewId,
        skill: input.skill,
        question: input.question,
        answer: input.answer,
        score: input.score,
        feedback: input.feedback,
      }),
      'save the interview answer',
    )
  }

  /** Upserts a skill's blended mastery. Uses the real (user_id, skill) unique constraint. */
  async upsertSkillMastery(input: UpsertSkillInput): Promise<void> {
    const userId = this.requireUserId()
    const now = new Date().toISOString()
    this.unwrap(
      await supabase.from('user_skills').upsert(
        {
          user_id: userId,
          skill: input.skill,
          category: input.category,
          mastery: input.mastery,
          attempts: input.attempts,
          last_scored_at: now,
          updated_at: now,
        },
        { onConflict: 'user_id,skill' },
      ),
      'update your skill mastery',
    )
  }
}

/** Shared singleton — import this from stores. The class is exported for testing/DI. */
export const interviewPrepRepository = new InterviewPrepRepository()
