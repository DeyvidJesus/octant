// Typed email errors with a stable `code`; the transport decides `retryable` while the provider response is known.

/** Base class for every failure raised by this package. */
export class EmailError extends Error {
  /** Stable machine-readable code for branching and telemetry. */
  readonly code: string

  constructor(message: string, options?: { code?: string; cause?: unknown }) {
    super(message, { cause: options?.cause })
    this.name = 'EmailError'
    this.code = options?.code ?? 'EMAIL_ERROR'
  }
}

/** Misconfiguration — a missing API key, a malformed `EMAIL_FROM`. Never retryable. */
export class EmailConfigError extends EmailError {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, { code: 'EMAIL_CONFIG', cause: options?.cause })
    this.name = 'EmailConfigError'
  }
}

/** A recipient address or payload the provider would reject. Never retryable. */
export class EmailValidationError extends EmailError {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, { code: 'EMAIL_VALIDATION', cause: options?.cause })
    this.name = 'EmailValidationError'
  }
}

/** A template threw while rendering, or produced empty output. Never retryable. */
export class EmailRenderError extends EmailError {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, { code: 'EMAIL_RENDER', cause: options?.cause })
    this.name = 'EmailRenderError'
  }
}

/** The provider did not accept the message; `retryable` separates 5xx/timeouts from permanent rejections. */
export class EmailTransportError extends EmailError {
  /** HTTP status the provider returned, when there was one. */
  readonly status: number | null
  /** Whether re-sending the identical request could plausibly succeed. */
  readonly retryable: boolean
  /** The provider's own error identifier (e.g. Resend's `rate_limit_exceeded`). */
  readonly providerCode: string | null

  constructor(
    message: string,
    options?: {
      code?: string
      cause?: unknown
      status?: number | null
      retryable?: boolean
      providerCode?: string | null
    },
  ) {
    super(message, { code: options?.code ?? 'EMAIL_TRANSPORT', cause: options?.cause })
    this.name = 'EmailTransportError'
    this.status = options?.status ?? null
    this.retryable = options?.retryable ?? false
    this.providerCode = options?.providerCode ?? null
  }
}

/** Provider throttling. Always retryable; carries the provider's hint when it sends one. */
export class EmailRateLimitError extends EmailTransportError {
  /** How long the provider asked us to wait, in milliseconds, when it said. */
  readonly retryAfterMs: number | null

  constructor(
    message: string,
    options?: { cause?: unknown; status?: number | null; providerCode?: string | null; retryAfterMs?: number | null },
  ) {
    super(message, {
      code: 'EMAIL_RATE_LIMIT',
      cause: options?.cause,
      status: options?.status ?? 429,
      retryable: true,
      providerCode: options?.providerCode ?? null,
    })
    this.name = 'EmailRateLimitError'
    this.retryAfterMs = options?.retryAfterMs ?? null
  }
}

/** Recipient is suppressed (hard bounce or complaint); sending again would hurt domain reputation. */
export class EmailSuppressedError extends EmailError {
  readonly recipient: string

  constructor(recipient: string, options?: { cause?: unknown }) {
    super(`${recipient} is suppressed and will not receive email.`, {
      code: 'EMAIL_SUPPRESSED',
      cause: options?.cause,
    })
    this.name = 'EmailSuppressedError'
    this.recipient = recipient
  }
}

export function isEmailError(error: unknown): error is EmailError {
  return error instanceof EmailError
}

/** Collapses any thrown value into the `{ code, message }` pair stored in `email_log`. */
export function describeEmailError(error: unknown): { code: string; message: string } {
  if (isEmailError(error)) return { code: error.code, message: error.message }
  if (error instanceof Error) return { code: 'EMAIL_UNKNOWN', message: error.message }
  return { code: 'EMAIL_UNKNOWN', message: String(error) }
}
