// Typed, user-facing errors that repositories raise instead of leaking `PostgrestError`.

/** Base class for all recoverable, user-surfaceable application errors. */
export class AppError extends Error {
  /** Stable machine-readable code for branching / telemetry (never the raw message). */
  readonly code: string

  constructor(message: string, options?: { code?: string; cause?: unknown }) {
    super(message, { cause: options?.cause })
    this.name = 'AppError'
    this.code = options?.code ?? 'APP_ERROR'
  }
}

/** A data-access failure originating from the persistence layer (Supabase / Postgres). */
export class RepositoryError extends AppError {
  constructor(message: string, options?: { code?: string; cause?: unknown }) {
    super(message, { code: options?.code ?? 'REPOSITORY_ERROR', cause: options?.cause })
    this.name = 'RepositoryError'
  }
}

/** Raised when an operation requires a signed-in user but none is present. */
export class UnauthenticatedError extends AppError {
  constructor(message = 'You need to be signed in to do that.') {
    super(message, { code: 'UNAUTHENTICATED' })
    this.name = 'UnauthenticatedError'
  }
}
