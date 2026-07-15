import { createJSONStorage, type StateStorage } from 'zustand/middleware'
import { dexieStore } from './dexieStore'

const stateStorage: StateStorage = {
  getItem: (name) => dexieStore.get<string>(name),
  setItem: (name, value) => dexieStore.set(name, value),
  removeItem: (name) => dexieStore.remove(name),
}

/** Storage adapter shared by every persisted Zustand store. */
export const appStorage = createJSONStorage(() => stateStorage)
