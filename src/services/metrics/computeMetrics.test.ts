import { describe, expect, it } from 'vitest'
import {
  activityByWeek,
  averageMatchScore,
  averageTimeToOffer,
  funnel,
  furthestFunnelIndex,
  matchScoreDistribution,
  outcomes,
  rates,
  timeInStage,
} from './computeMetrics'
import type { Application, ApplicationEvent, ApplicationStage } from '@/types/application'

let seq = 0
const stageChange = (from: ApplicationStage, to: ApplicationStage, at: string): ApplicationEvent => ({
  id: `e${seq++}`,
  at,
  kind: 'stage_change',
  fromStage: from,
  toStage: to,
})

const app = (overrides: Partial<Application> = {}): Application => ({
  id: `app${seq++}`,
  company: 'Acme',
  role: 'Engineer',
  workMode: 'remote',
  stage: 'applied',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  links: [],
  notes: '',
  events: [],
  ...overrides,
})

describe('furthestFunnelIndex', () => {
  it('uses the furthest stage from history and maps accepted to offer', () => {
    expect(furthestFunnelIndex(app({ stage: 'applied' }))).toBe(1)
    expect(furthestFunnelIndex(app({ stage: 'accepted' }))).toBe(5) // accepted implies offer reached
    const rejected = app({
      stage: 'rejected',
      events: [stageChange('applied', 'screening', '2026-01-02T00:00:00.000Z')],
    })
    expect(furthestFunnelIndex(rejected)).toBe(2) // reached screening before rejection
  })
})

describe('funnel', () => {
  it('produces monotonically non-increasing counts with conversion rates', () => {
    const apps = [
      app({ stage: 'applied' }),
      app({ stage: 'screening', events: [stageChange('applied', 'screening', '2026-01-02T00:00:00.000Z')] }),
      app({ stage: 'offer', events: [stageChange('applied', 'offer', '2026-01-03T00:00:00.000Z')] }),
    ]
    const steps = funnel(apps)
    const byStage = Object.fromEntries(steps.map((s) => [s.stage, s.count]))
    expect(byStage.applied).toBe(3)
    expect(byStage.screening).toBe(2)
    expect(byStage.offer).toBe(1)
    // applied → screening conversion = 2/3
    const screening = steps.find((s) => s.stage === 'screening')!
    expect(Math.round(screening.conversion)).toBe(67)
  })
})

describe('outcomes', () => {
  it('buckets each application into one mutually-exclusive outcome', () => {
    const result = outcomes([
      app({ stage: 'offer' }),
      app({ stage: 'accepted' }),
      app({ stage: 'rejected' }),
      app({ stage: 'ghosted' }),
      app({ stage: 'withdrawn' }),
      app({ stage: 'screening' }),
    ])
    expect(result).toEqual({ offer: 2, rejected: 1, ghosted: 1, withdrawn: 1, active: 1 })
  })
})

describe('rates', () => {
  it('computes response, offer, and ghost rates over submitted applications', () => {
    const apps = [
      app({ stage: 'saved' }), // not submitted — excluded from denominator
      app({ stage: 'applied' }), // submitted, no response
      app({ stage: 'screening', events: [stageChange('applied', 'screening', '2026-01-02T00:00:00.000Z')] }),
      app({ stage: 'offer', events: [stageChange('applied', 'offer', '2026-01-03T00:00:00.000Z')] }),
      app({ stage: 'ghosted' }),
    ]
    const r = rates(apps)
    expect(r.total).toBe(4) // saved excluded
    expect(Math.round(r.responseRate)).toBe(50) // screening + offer responded of 4
    expect(Math.round(r.offerRate)).toBe(25)
    expect(Math.round(r.ghostRate)).toBe(25)
  })

  it('returns zeroes when nothing has been submitted', () => {
    expect(rates([app({ stage: 'saved' })])).toEqual({ total: 0, responseRate: 0, offerRate: 0, ghostRate: 0 })
  })
})

describe('timeInStage / averageTimeToOffer', () => {
  it('averages days spent in a stage between consecutive transitions', () => {
    const apps = [
      app({
        stage: 'interviewing',
        events: [
          stageChange('saved', 'applied', '2026-01-01T00:00:00.000Z'),
          stageChange('applied', 'screening', '2026-01-05T00:00:00.000Z'), // 4 days in applied
          stageChange('screening', 'interviewing', '2026-01-07T00:00:00.000Z'), // 2 days in screening
        ],
      }),
    ]
    const durations = timeInStage(apps)
    const applied = durations.find((d) => d.stage === 'applied')!
    expect(applied.avgDays).toBe(4)
    const screening = durations.find((d) => d.stage === 'screening')!
    expect(screening.avgDays).toBe(2)
  })

  it('computes average time to offer from creation', () => {
    const apps = [
      app({
        createdAt: '2026-01-01T00:00:00.000Z',
        stage: 'offer',
        events: [stageChange('applied', 'offer', '2026-01-11T00:00:00.000Z')],
      }),
    ]
    expect(averageTimeToOffer(apps)).toBe(10)
    expect(averageTimeToOffer([app({ stage: 'applied' })])).toBeNull()
  })
})

describe('activityByWeek', () => {
  it('buckets applications by Monday-anchored ISO week', () => {
    const apps = [
      app({ createdAt: '2026-01-07T12:00:00.000Z' }), // Wed → week of Mon Jan 5
      app({ createdAt: '2026-01-05T00:00:00.000Z' }), // Mon Jan 5
      app({ createdAt: '2026-01-14T00:00:00.000Z' }), // week of Mon Jan 12
    ]
    const weeks = activityByWeek(apps)
    expect(weeks).toEqual([
      { weekStart: '2026-01-05', count: 2 },
      { weekStart: '2026-01-12', count: 1 },
    ])
  })
})

describe('match score metrics', () => {
  it('bucketizes and averages match scores, ignoring undefined', () => {
    const apps = [
      app({ matchScore: 15 }),
      app({ matchScore: 65 }),
      app({ matchScore: 82 }),
      app({ matchScore: undefined }),
    ]
    const dist = matchScoreDistribution(apps)
    expect(Object.fromEntries(dist.map((b) => [b.label, b.count]))).toEqual({
      '0–19': 1,
      '20–39': 0,
      '40–59': 0,
      '60–79': 1,
      '80–100': 1,
    })
    expect(averageMatchScore(apps)).toBeCloseTo((15 + 65 + 82) / 3)
    expect(averageMatchScore([app({ matchScore: undefined })])).toBeNull()
  })
})
