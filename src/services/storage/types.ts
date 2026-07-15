/**
 * The persistence seam of CareerOS. Everything above this interface is
 * storage-agnostic; today it's backed by Dexie (IndexedDB), and swapping the
 * backing (e.g. file-based sync) touches only the implementation.
 *
 * Data is stored as one document per aggregate under fixed keys — no
 * per-entity rows. At this app's scale, whole-document read/write is the
 * simple and correct model.
 */
export interface KeyValueStore {
  get<T>(key: string): Promise<T | null>
  set<T>(key: string, value: T): Promise<void>
  remove(key: string): Promise<void>
  keys(): Promise<string[]>
}

export const STORAGE_KEYS = {
  resume: 'careeros:resume',
  jobs: 'careeros:jobs',
  applications: 'careeros:applications',
  settings: 'careeros:settings',
} as const

export const STORAGE_KEY_PREFIX = 'careeros:'
