import { useJobsStore } from './jobsStore'
import { useApplicationsStore } from './applicationsStore'
import { useSettingsStore } from './settingsStore'
import { useResumeStore } from './resumeStore'
import { useInterviewPrepStore } from './interviewPrepStore'
import { useGeneratorStore } from './generatorStore'
import { useDiscoveryStore } from './discoveryStore'
import { useSubscriptionStore } from './subscriptionStore'
import { useSearchProfileStore } from './searchProfileStore'

/** Resets every store on sign-out or user switch so no account's data lingers in memory. */
export function resetAllStores(): void {
  useJobsStore.getState().reset()
  useApplicationsStore.getState().reset()
  useSettingsStore.getState().reset()
  useResumeStore.getState().reset()
  useInterviewPrepStore.getState().reset()
  useGeneratorStore.getState().reset()
  useDiscoveryStore.getState().reset()
  useSubscriptionStore.getState().reset()
  useSearchProfileStore.getState().reset()
}
