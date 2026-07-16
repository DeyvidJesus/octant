import type { InterviewPrepStatus, PrepQuestion, TrackedQuestion } from '@/types/interviewPrep'

/**
 * Pure reducers for interview-prep progress. Kept framework-free (no zustand,
 * no persistence) so they are unit-testable in isolation and the store is a
 * thin wrapper. Keyed by the deterministic question id.
 */
export type ProgressMap = Record<string, TrackedQuestion>

export function baseFrom(question: PrepQuestion): TrackedQuestion {
  return {
    id: question.id,
    category: question.category,
    difficulty: question.difficulty,
    question: question.question,
    topic: question.topic,
    confidence: 0,
    status: 'not_started',
    mastered: false,
  }
}

export function clampConfidence(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.max(0, Math.min(100, Math.round(value)))
}

function upsert(
  tracked: ProgressMap,
  question: PrepQuestion,
  patch: Partial<TrackedQuestion>,
  now: string,
): ProgressMap {
  const existing = tracked[question.id] ?? baseFrom(question)
  return {
    ...tracked,
    [question.id]: { ...existing, ...patch, lastReviewedAt: now },
  }
}

export function applyRate(tracked: ProgressMap, question: PrepQuestion, confidence: number, now: string): ProgressMap {
  return upsert(tracked, question, { confidence: clampConfidence(confidence), status: 'in_progress' }, now)
}

export function applyStatus(
  tracked: ProgressMap,
  question: PrepQuestion,
  status: InterviewPrepStatus,
  now: string,
): ProgressMap {
  return upsert(tracked, question, { status, mastered: status === 'mastered' }, now)
}

export function applyToggleMastered(tracked: ProgressMap, question: PrepQuestion, now: string): ProgressMap {
  const existing = tracked[question.id] ?? baseFrom(question)
  const mastered = !existing.mastered
  return {
    ...tracked,
    [question.id]: {
      ...existing,
      mastered,
      status: mastered ? 'mastered' : 'in_progress',
      confidence: mastered ? Math.max(existing.confidence, 100) : existing.confidence,
      lastReviewedAt: now,
    },
  }
}

export function applyNotes(tracked: ProgressMap, question: PrepQuestion, notes: string, now: string): ProgressMap {
  return upsert(tracked, question, { notes }, now)
}

export function applyRemove(tracked: ProgressMap, id: string): ProgressMap {
  const next = { ...tracked }
  delete next[id]
  return next
}
