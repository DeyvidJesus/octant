// Retry for provider calls; `sleep` and `random` are injected so tests assert exact delays.
// Only safe because every send carries an idempotency key, otherwise a timeout could deliver twice.

import { EmailError, EmailRateLimitError, EmailTransportError } from '../errors.ts'

export interface RetryPolicy {
  /** Total attempts, including the first. `1` disables retrying. */
  attempts: number
  /** Delay before the 2nd attempt; doubles thereafter. */
  baseDelayMs: number
  /** Ceiling for the computed delay, before jitter. */
  maxDelayMs: number
}

export const DEFAULT_RETRY_POLICY: RetryPolicy = {
  attempts: 3,
  baseDelayMs: 300,
  maxDelayMs: 4_000,
}

export interface RetryDeps {
  sleep: (ms: number) => Promise<void>
  /** Returns [0, 1). Injected so jitter is reproducible under test. */
  random: () => number
}

export const defaultRetryDeps: RetryDeps = {
  sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  random: Math.random,
}

/** Capped exponential backoff, jittered to 50-100% so sends don't retry in lockstep after an outage. */
export function backoffDelay(attempt: number, policy: RetryPolicy, random: () => number): number {
  const exponential = policy.baseDelayMs * 2 ** Math.max(0, attempt - 1)
  const capped = Math.min(policy.maxDelayMs, exponential)
  return Math.round(capped * (0.5 + 0.5 * random()))
}

/** Transport errors carry their own flag; unknown throws (usually dropped connections) are retryable. */
export function isRetryable(error: unknown): boolean {
  if (error instanceof EmailTransportError) return error.retryable
  // Config, validation, render and suppressed errors are permanent.
  if (error instanceof EmailError) return false
  return true
}

/** Honours a provider Retry-After (capped at maxDelayMs), otherwise uses backoff. */
function delayFor(attempt: number, error: unknown, policy: RetryPolicy, random: () => number): number {
  if (error instanceof EmailRateLimitError && error.retryAfterMs !== null) {
    return Math.min(error.retryAfterMs, policy.maxDelayMs)
  }
  return backoffDelay(attempt, policy, random)
}

/** Retries transient failures per `policy` and rethrows the last error once attempts run out. */
export async function withRetry<T>(
  operation: (attempt: number) => Promise<T>,
  policy: RetryPolicy = DEFAULT_RETRY_POLICY,
  deps: RetryDeps = defaultRetryDeps,
  onRetry?: (info: { attempt: number; delayMs: number; error: unknown }) => void,
): Promise<T> {
  const attempts = Math.max(1, policy.attempts)
  let lastError: unknown

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await operation(attempt)
    } catch (error) {
      lastError = error
      const isLastAttempt = attempt === attempts
      if (isLastAttempt || !isRetryable(error)) throw error

      const delayMs = delayFor(attempt, error, policy, deps.random)
      onRetry?.({ attempt, delayMs, error })
      await deps.sleep(delayMs)
    }
  }

  // Unreachable; keeps TypeScript happy.
  throw lastError
}
