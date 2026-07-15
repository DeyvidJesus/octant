import { describe, it, expect } from 'vitest'
import { exportBackup, importBackup, clearAllData } from './backup'
import type { KeyValueStore } from './types'

function memoryStore(): KeyValueStore {
  const map = new Map<string, unknown>()
  return {
    get: async (key) => (map.has(key) ? (map.get(key) as never) : null),
    set: async (key, value) => void map.set(key, value),
    remove: async (key) => void map.delete(key),
    keys: async () => [...map.keys()],
  }
}

describe('backup', () => {
  it('exports only career-os keys', async () => {
    const store = memoryStore()
    await store.set('careeros:resume', { a: 1 })
    await store.set('careeros:jobs', { b: 2 })
    await store.set('other:key', 'ignored')

    const backup = await exportBackup(store)
    expect(Object.keys(backup.data).sort()).toEqual(['careeros:jobs', 'careeros:resume'])
    expect(backup.app).toBe('career-os')
  })

  it('round-trips data into a fresh store', async () => {
    const source = memoryStore()
    await source.set('careeros:resume', { summary: 'hello' })
    const backup = await exportBackup(source)

    const target = memoryStore()
    await importBackup(target, backup)
    expect(await target.get('careeros:resume')).toEqual({ summary: 'hello' })
  })

  it('rejects a file that is not a career-os backup', async () => {
    const store = memoryStore()
    await expect(importBackup(store, { app: 'other-app', data: {} })).rejects.toThrow()
    await expect(importBackup(store, null)).rejects.toThrow()
  })

  it('clears only career-os keys', async () => {
    const store = memoryStore()
    await store.set('careeros:resume', { a: 1 })
    await store.set('other:key', 'kept')
    await clearAllData(store)
    expect(await store.keys()).toEqual(['other:key'])
  })
})
