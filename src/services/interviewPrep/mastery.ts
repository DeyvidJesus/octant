import type { InterviewQuestionCategory } from '@/types/interviewPrep'

// Pure mastery math for the interview simulation; persistence lives in the repository/store.

export interface MasteryState {
  mastery: number
  attempts: number
}

/** A skill is "mastered" for readiness purposes at or above this blended score. */
export const MASTERY_THRESHOLD = 80

/** Clamps an AI answer score to an integer 0-100. */
export function clampScore(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.max(0, Math.min(100, Math.round(value)))
}

/** Running average of all answer scores for the skill. */
export function blendMastery(prev: MasteryState | null, score: number): MasteryState {
  const clamped = clampScore(score)
  const prevAttempts = prev?.attempts ?? 0
  const prevMastery = prev?.mastery ?? 0
  const attempts = prevAttempts + 1
  const mastery = Math.round((prevMastery * prevAttempts + clamped) / attempts)
  return { mastery, attempts }
}

/** The skill key a question maps to for mastery tracking — its topic, else its category. */
export function skillKeyFor(topic: string | undefined, category: InterviewQuestionCategory): string {
  const trimmed = topic?.trim()
  return trimmed && trimmed.length > 0 ? trimmed : category
}
