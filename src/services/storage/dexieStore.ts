import Dexie, { type EntityTable } from 'dexie'
import type { KeyValueStore } from './types'

interface KvRow {
  key: string
  value: unknown
}

class CareerOsDatabase extends Dexie {
  kv!: EntityTable<KvRow, 'key'>

  constructor() {
    super('career-os')
    this.version(1).stores({
      kv: 'key',
    })
  }
}

const db = new CareerOsDatabase()

export const dexieStore: KeyValueStore = {
  async get<T>(key: string): Promise<T | null> {
    const row = await db.kv.get(key)
    return row === undefined ? null : (row.value as T)
  },

  async set<T>(key: string, value: T): Promise<void> {
    await db.kv.put({ key, value })
  },

  async remove(key: string): Promise<void> {
    await db.kv.delete(key)
  },

  async keys(): Promise<string[]> {
    return db.kv.toCollection().primaryKeys()
  },
}
