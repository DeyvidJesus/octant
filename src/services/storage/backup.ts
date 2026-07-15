import type { BackupFile } from '@/types/backup'
import type { KeyValueStore } from './types'
import { STORAGE_KEY_PREFIX } from './types'

export async function exportBackup(store: KeyValueStore): Promise<BackupFile> {
  const allKeys = await store.keys()
  const appKeys = allKeys.filter((key) => key.startsWith(STORAGE_KEY_PREFIX))

  const data: Record<string, unknown> = {}
  for (const key of appKeys) {
    data[key] = await store.get(key)
  }

  return {
    app: 'career-os',
    schemaVersion: 1,
    exportedAt: new Date().toISOString(),
    data,
  }
}

export async function importBackup(store: KeyValueStore, file: unknown): Promise<void> {
  if (!isBackupFile(file)) {
    throw new Error('Invalid backup file: expected a CareerOS export (schema version 1).')
  }
  for (const [key, value] of Object.entries(file.data)) {
    if (key.startsWith(STORAGE_KEY_PREFIX)) {
      await store.set(key, value)
    }
  }
}

export async function clearAllData(store: KeyValueStore): Promise<void> {
  const allKeys = await store.keys()
  for (const key of allKeys) {
    if (key.startsWith(STORAGE_KEY_PREFIX)) {
      await store.remove(key)
    }
  }
}

function isBackupFile(value: unknown): value is BackupFile {
  if (typeof value !== 'object' || value === null) return false
  const candidate = value as Record<string, unknown>
  return (
    candidate.app === 'career-os' &&
    candidate.schemaVersion === 1 &&
    typeof candidate.data === 'object' &&
    candidate.data !== null
  )
}
