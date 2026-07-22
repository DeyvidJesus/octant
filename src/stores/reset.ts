import { useJobsStore } from './jobsStore'
import { useApplicationsStore } from './applicationsStore'
import { useSettingsStore } from './settingsStore'
import { useResumeStore } from './resumeStore'
import { useInterviewPrepStore } from './interviewPrepStore'
import { useGeneratorStore } from './generatorStore'
import { useDiscoveryStore } from './discoveryStore'
import { useSubscriptionStore } from './subscriptionStore'

/**
 * Wipes every store back to its empty initial state. Called on sign-out and on a user switch so one
 * account's data never lingers in memory for the next session on a shared browser (audit finding H2).
 */
export function resetAllStores(): void {
  useJobsStore.getState().reset()
  useApplicationsStore.getState().reset()
  useSettingsStore.getState().reset()
  useResumeStore.getState().reset()
  useInterviewPrepStore.getState().reset()
  useGeneratorStore.getState().reset()
  useDiscoveryStore.getState().reset()
  useSubscriptionStore.getState().reset()
}
