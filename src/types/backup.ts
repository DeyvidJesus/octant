/** Envelope for JSON export/import — the user's data escape hatch. */
export interface BackupFile {
  app: 'career-os'
  schemaVersion: 1
  exportedAt: string
  /** Every persisted `careeros:*` key, verbatim. */
  data: Record<string, unknown>
}
