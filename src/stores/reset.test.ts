import { describe, it, expect, beforeEach } from 'vitest'
import { resetAllStores } from './reset'
import { useJobsStore } from './jobsStore'
import { useApplicationsStore } from './applicationsStore'
import { useSettingsStore } from './settingsStore'
import { useResumeStore } from './resumeStore'
import { useInterviewPrepStore } from './interviewPrepStore'
import { useGeneratorStore } from './generatorStore'
import { useDiscoveryStore } from './discoveryStore'
import { useSubscriptionStore } from './subscriptionStore'
import type { JobOpportunity } from '@/types/job'

const fakeJob: JobOpportunity = {
  id: 'job-1',
  company: 'Acme',
  role: 'Engineer',
  description: 'desc',
  workMode: 'remote',
  tags: [],
  createdAt: '2026-01-01T00:00:00.000Z',
  archived: false,
  source: 'manual',
}

describe('resetAllStores', () => {
  beforeEach(() => {
    // Seed every store with data via setState (no repository/network involved).
    useJobsStore.setState({ jobs: [fakeJob], analyses: { 'job-1': {} as never } })
    useApplicationsStore.setState({ applications: [{ id: 'a1' } as never] })
    useSettingsStore.setState({ discovery: { foo: 1 } as never, onboardingCompleted: true })
    useInterviewPrepStore.setState({ skills: { react: { skill: 'react' } as never } })
    useGeneratorStore.setState({ tailored: { 'job-1': {} as never } })
    useDiscoveryStore.setState({
      candidates: [{ id: 'c1' } as never],
      dismissedKeys: ['k'],
      lastSweepAt: '2026-01-01',
      pendingInteractionId: 'int-1',
    })
    useSubscriptionStore.setState({ tier: 'pro' })
  })

  it('wipes every store back to empty so no data bleeds across sessions', () => {
    resetAllStores()

    expect(useJobsStore.getState().jobs).toEqual([])
    expect(useJobsStore.getState().analyses).toEqual({})
    expect(useApplicationsStore.getState().applications).toEqual([])
    expect(useSettingsStore.getState().onboardingCompleted).toBe(false)
    expect(useResumeStore.getState().knowledgeBase.facts).toEqual([])
    expect(useResumeStore.getState().knowledgeBase.roles).toEqual([])
    expect(useInterviewPrepStore.getState().skills).toEqual({})
    expect(useGeneratorStore.getState().tailored).toEqual({})
    expect(useDiscoveryStore.getState().candidates).toEqual([])
    expect(useDiscoveryStore.getState().dismissedKeys).toEqual([])
    expect(useDiscoveryStore.getState().pendingInteractionId).toBeNull()
    expect(useSubscriptionStore.getState().tier).toBe('free')
  })
})
