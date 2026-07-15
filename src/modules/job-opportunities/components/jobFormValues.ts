import type { JobOpportunity, WorkMode } from '@/types/job'

export interface JobFormValues {
  company: string
  role: string
  description: string
  url: string
  category: string
  salaryRange: string
  location: string
  workMode: WorkMode
  tags: string[]
}

export const WORK_MODES: WorkMode[] = ['remote', 'hybrid', 'onsite', 'unknown']

export function toFormValues(job?: JobOpportunity): JobFormValues {
  return {
    company: job?.company ?? '',
    role: job?.role ?? '',
    description: job?.description ?? '',
    url: job?.url ?? '',
    category: job?.category ?? '',
    salaryRange: job?.salaryRange ?? '',
    location: job?.location ?? '',
    workMode: job?.workMode ?? 'remote',
    tags: job?.tags ?? [],
  }
}
