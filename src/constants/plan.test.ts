import { describe, expect, it } from 'vitest'
import { FREE_LIMITS, jobLimitReached, remainingJobSlots } from './plan'

describe('remainingJobSlots', () => {
  it('counts down to zero on Free and never goes negative', () => {
    expect(remainingJobSlots('free', 0)).toBe(FREE_LIMITS.jobs)
    expect(remainingJobSlots('free', FREE_LIMITS.jobs - 1)).toBe(1)
    expect(remainingJobSlots('free', FREE_LIMITS.jobs)).toBe(0)
    expect(remainingJobSlots('free', FREE_LIMITS.jobs + 5)).toBe(0)
  })

  it('is unlimited on Pro', () => {
    expect(remainingJobSlots('pro', 1_000)).toBe(Infinity)
  })

  it('agrees with jobLimitReached', () => {
    for (let count = 0; count <= FREE_LIMITS.jobs + 1; count++) {
      expect(remainingJobSlots('free', count) === 0).toBe(jobLimitReached('free', count))
    }
  })
})
