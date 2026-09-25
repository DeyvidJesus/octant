import { afterEach, describe, expect, it, vi } from 'vitest'

const getTier = vi.fn()
vi.mock('@/repositories/SubscriptionRepository', () => ({
  subscriptionRepository: { getTier: () => getTier() },
}))

const { useSubscriptionStore } = await import('./subscriptionStore')

afterEach(() => {
  getTier.mockReset()
  useSubscriptionStore.getState().reset()
})

describe('refreshUntilPro', () => {
  it('polls until the webhook has flipped the tier to pro', async () => {
    getTier.mockResolvedValueOnce('free').mockResolvedValueOnce('free').mockResolvedValueOnce('pro')
    await expect(useSubscriptionStore.getState().refreshUntilPro({ intervalMs: 0 })).resolves.toBe(true)
    expect(getTier).toHaveBeenCalledTimes(3)
    expect(useSubscriptionStore.getState().tier).toBe('pro')
  })

  it('gives up after the last attempt and leaves the tier as read', async () => {
    getTier.mockResolvedValue('free')
    await expect(useSubscriptionStore.getState().refreshUntilPro({ attempts: 3, intervalMs: 0 })).resolves.toBe(false)
    expect(getTier).toHaveBeenCalledTimes(3)
    expect(useSubscriptionStore.getState().tier).toBe('free')
  })

  it('stops as soon as the caller aborts (e.g. the page unmounted)', async () => {
    const controller = new AbortController()
    getTier.mockImplementation(async () => {
      controller.abort()
      return 'pro'
    })
    await expect(
      useSubscriptionStore.getState().refreshUntilPro({ intervalMs: 0, signal: controller.signal }),
    ).resolves.toBe(false)
    expect(getTier).toHaveBeenCalledTimes(1)
    expect(useSubscriptionStore.getState().tier).toBe('free')
  })
})
