import { describe, expect, it, vi } from 'vitest'
import {
  EmailConfigError,
  EmailRateLimitError,
  EmailRenderError,
  EmailSuppressedError,
  EmailTransportError,
  EmailValidationError,
} from '../errors.ts'
import { backoffDelay, isRetryable, withRetry, type RetryDeps, type RetryPolicy } from './retry.ts'

const POLICY: RetryPolicy = { attempts: 3, baseDelayMs: 100, maxDelayMs: 1_000 }

/** Records requested delays instead of waiting, and pins jitter, so assertions are exact. */
function testDeps(random = 1): RetryDeps & { delays: number[] } {
  const delays: number[] = []
  return {
    delays,
    sleep: (ms) => {
      delays.push(ms)
      return Promise.resolve()
    },
    random: () => random,
  }
}

describe('isRetryable', () => {
  it('follows the flag on a transport error rather than guessing from the message', () => {
    expect(isRetryable(new EmailTransportError('boom', { retryable: true }))).toBe(true)
    expect(isRetryable(new EmailTransportError('boom', { retryable: false }))).toBe(false)
  })

  it('always retries rate limits', () => {
    expect(isRetryable(new EmailRateLimitError('slow down'))).toBe(true)
  })

  it('never retries permanent, typed failures', () => {
    expect(isRetryable(new EmailConfigError('missing key'))).toBe(false)
    expect(isRetryable(new EmailValidationError('bad address'))).toBe(false)
    expect(isRetryable(new EmailRenderError('template blew up'))).toBe(false)
    expect(isRetryable(new EmailSuppressedError('ana@example.com'))).toBe(false)
  })

  it('retries unknown throws, which in practice are dropped connections', () => {
    expect(isRetryable(new TypeError('fetch failed'))).toBe(true)
    expect(isRetryable('nope')).toBe(true)
  })
})

describe('backoffDelay', () => {
  it('doubles per attempt', () => {
    // random() === 1 → the full capped value, no jitter reduction.
    expect(backoffDelay(1, POLICY, () => 1)).toBe(100)
    expect(backoffDelay(2, POLICY, () => 1)).toBe(200)
    expect(backoffDelay(3, POLICY, () => 1)).toBe(400)
  })

  it('caps at maxDelayMs', () => {
    expect(backoffDelay(10, POLICY, () => 1)).toBe(1_000)
  })

  it('applies full jitter, never dropping below half the capped value', () => {
    expect(backoffDelay(2, POLICY, () => 0)).toBe(100)
    expect(backoffDelay(2, POLICY, () => 0.5)).toBe(150)
  })
})

describe('withRetry', () => {
  it('returns the first success without sleeping', async () => {
    const deps = testDeps()
    const operation = vi.fn().mockResolvedValue('ok')

    await expect(withRetry(operation, POLICY, deps)).resolves.toBe('ok')
    expect(operation).toHaveBeenCalledTimes(1)
    expect(deps.delays).toEqual([])
  })

  it('retries a transient failure and succeeds', async () => {
    const deps = testDeps()
    const operation = vi
      .fn()
      .mockRejectedValueOnce(new EmailTransportError('502', { retryable: true }))
      .mockResolvedValue('ok')

    await expect(withRetry(operation, POLICY, deps)).resolves.toBe('ok')
    expect(operation).toHaveBeenCalledTimes(2)
    expect(deps.delays).toEqual([100])
  })

  it('gives up after the configured number of attempts and rethrows the LAST error', async () => {
    const deps = testDeps()
    const operation = vi
      .fn()
      .mockRejectedValueOnce(new EmailTransportError('first', { retryable: true }))
      .mockRejectedValueOnce(new EmailTransportError('second', { retryable: true }))
      .mockRejectedValue(new EmailTransportError('third', { retryable: true }))

    await expect(withRetry(operation, POLICY, deps)).rejects.toThrow('third')
    expect(operation).toHaveBeenCalledTimes(3)
    // Two sleeps for three attempts — it must not sleep after the final failure.
    expect(deps.delays).toEqual([100, 200])
  })

  it('fails immediately on a permanent error without burning attempts', async () => {
    const deps = testDeps()
    const operation = vi.fn().mockRejectedValue(new EmailValidationError('bad address'))

    await expect(withRetry(operation, POLICY, deps)).rejects.toThrow(EmailValidationError)
    expect(operation).toHaveBeenCalledTimes(1)
    expect(deps.delays).toEqual([])
  })

  it("honours a provider's Retry-After instead of its own backoff", async () => {
    const deps = testDeps()
    const operation = vi
      .fn()
      .mockRejectedValueOnce(new EmailRateLimitError('slow down', { retryAfterMs: 750 }))
      .mockResolvedValue('ok')

    await expect(withRetry(operation, POLICY, deps)).resolves.toBe('ok')
    expect(deps.delays).toEqual([750])
  })

  it('clamps an unreasonable Retry-After to maxDelayMs', async () => {
    const deps = testDeps()
    const operation = vi
      .fn()
      .mockRejectedValueOnce(new EmailRateLimitError('slow down', { retryAfterMs: 600_000 }))
      .mockResolvedValue('ok')

    await withRetry(operation, POLICY, deps)
    expect(deps.delays).toEqual([1_000])
  })

  it('reports each retry so the caller can log it', async () => {
    const deps = testDeps()
    const onRetry = vi.fn()
    const operation = vi
      .fn()
      .mockRejectedValueOnce(new EmailTransportError('502', { retryable: true }))
      .mockResolvedValue('ok')

    await withRetry(operation, POLICY, deps, onRetry)
    expect(onRetry).toHaveBeenCalledTimes(1)
    expect(onRetry.mock.calls[0][0]).toMatchObject({ attempt: 1, delayMs: 100 })
  })

  it('treats attempts: 1 as "no retrying"', async () => {
    const deps = testDeps()
    const operation = vi.fn().mockRejectedValue(new EmailTransportError('502', { retryable: true }))

    await expect(withRetry(operation, { ...POLICY, attempts: 1 }, deps)).rejects.toThrow('502')
    expect(operation).toHaveBeenCalledTimes(1)
  })
})
