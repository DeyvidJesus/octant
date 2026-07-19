import type { Application, ApplicationStage } from '@/types/application'
import type { WorkMode } from '@/types/job'
import { toDateInput } from '@/utils/dates'

export interface ApplicationFormValues {
  company: string
  role: string
  stage: ApplicationStage
  priority: boolean
  salary: string
  location: string
  workMode: WorkMode
  applicationUrl: string
  /** `YYYY-MM-DD` for native date inputs. */
  appliedAt: string
  followUpAt: string
  recruiterName: string
  recruiterEmail: string
  recruiterLinkedin: string
  notes: string
  feedback: string
  rejectionReason: string
}

export const WORK_MODES: WorkMode[] = ['remote', 'hybrid', 'onsite', 'unknown']

export function toFormValues(application?: Application): ApplicationFormValues {
  return {
    company: application?.company ?? '',
    role: application?.role ?? '',
    stage: application?.stage ?? 'saved',
    priority: application?.priority ?? false,
    salary: application?.salary ?? '',
    location: application?.location ?? '',
    workMode: application?.workMode ?? 'remote',
    applicationUrl: application?.links[0]?.url ?? '',
    appliedAt: toDateInput(application?.appliedAt),
    followUpAt: toDateInput(application?.followUpAt),
    recruiterName: application?.recruiter?.name ?? '',
    recruiterEmail: application?.recruiter?.email ?? '',
    recruiterLinkedin: application?.recruiter?.linkedin ?? '',
    notes: application?.notes ?? '',
    feedback: application?.feedback ?? '',
    rejectionReason: application?.rejectionReason ?? '',
  }
}
