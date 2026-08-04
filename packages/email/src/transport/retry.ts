/**
 * Retry policy for provider calls.
 *
 * Pure and fully deterministic: `sleep` and `random` are injected, so the tests run instantly and
 * assert exact delays instead of tolerating a range. The codebase had no retry utility before this
 * (only single corrective re-prompts in the AI tasks), so this is intentionally small and local
 * rather than a general-purpose framework.
 *
 * Retrying is only safe because every send carries an idempotency key — see `ResendTransport`. Without
 * one, a timeout after the provider already queued the message would deliver it twice.
 */

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

/**
 * Exponential backoff with full jitter: the delay lands somewhere in [50%, 100%] of the capped
 * exponential value. Jitter matters because a provider outage makes every pending send retry in
 * lockstep otherwise, re-creating the thundering herd that caused the 5xx.
 */
export function backoffDelay(attempt: number, policy: RetryPolicy, random: () => number): number {
  const exponential = policy.baseDelayMs * 2 ** Math.max(0, attempt - 1)
  const capped = Math.min(policy.maxDelayMs, exponential)
  return Math.round(capped * (0.5 + 0.5 * random()))
}

/**
 * Whether re-issuing the identical request could plausibly succeed.
 *
 * Known email errors carry the answer already (decided at the transport boundary, where the provider's
 * status code was still visible). An UNKNOWN throw is treated as retryable: in practice that means a
 * `fetch` TypeError from a dropped connection, where the request may never have reached the provider.
 */
export function isRetryable(error: unknown): boolean {
  if (error instanceof EmailTransportError) return error.retryable
  // Any other typed email error (config, validation, render, suppressed) is a permanent refusal.
  if (error instanceof EmailError) return false
  return true
}

/** How long to wait before `attempt`, honouring a provider-supplied Retry-After when present. */
function delayFor(attempt: number, error: unknown, policy: RetryPolicy, random: () => number): number {
  if (error instanceof EmailRateLimitError && error.retryAfterMs !== null) {
    return Math.min(error.retryAfterMs, policy.maxDelayMs)
  }
  return backoffDelay(attempt, policy, random)
}

/**
 * Runs `operation`, retrying transient failures per `policy`. Rethrows the LAST error once attempts
 * are exhausted (not the first), so the surfaced message reflects the final state of the provider.
 */
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

  // Unreachable: the loop either returns or throws. Present so TS sees a total function.
  throw lastError
}
