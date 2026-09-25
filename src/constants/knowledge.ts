import type { FactStatus, FactType } from '@/types/resume'

export const FACT_TYPES: FactType[] = [
  'situation',
  'task',
  'responsibility',
  'action',
  'challenge',
  'achievement',
  'result',
  'business_value',
  'product_impact',
  'leadership',
  'mentoring',
  'communication',
  'stakeholder_interaction',
  'client_interaction',
  'problem_solving',
  'failure',
  'lesson',
  'technical_capability',
]

export const FACT_TYPE_LABELS: Record<FactType, string> = {
  situation: 'Situation',
  task: 'Task',
  responsibility: 'Responsibility',
  action: 'Action',
  challenge: 'Challenge',
  achievement: 'Achievement',
  result: 'Result',
  business_value: 'Business value',
  product_impact: 'Product impact',
  leadership: 'Leadership',
  mentoring: 'Mentoring',
  communication: 'Communication',
  stakeholder_interaction: 'Stakeholder interaction',
  client_interaction: 'Client interaction',
  problem_solving: 'Problem solving',
  failure: 'Failure',
  lesson: 'Lesson',
  technical_capability: 'Technical capability',
}

export const FACT_STATUSES: FactStatus[] = ['confirmed', 'needs_review', 'todo']

export const FACT_STATUS_LABELS: Record<FactStatus, string> = {
  confirmed: 'Confirmed',
  needs_review: 'Needs review',
  todo: 'To-do',
}

/** Badge tone per status — reuses the app's four Badge tones. */
export const FACT_STATUS_TONES: Record<FactStatus, 'default' | 'info' | 'success' | 'danger'> = {
  confirmed: 'success',
  needs_review: 'info',
  todo: 'default',
}
