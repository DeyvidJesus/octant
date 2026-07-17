/** Small immutable helpers for editing arrays of `{ id }` entities. */

export function updateById<T extends { id: string }>(items: T[], id: string, patch: Partial<T>): T[] {
  return items.map((item) => (item.id === id ? { ...item, ...patch } : item))
}

export function removeById<T extends { id: string }>(items: T[], id: string): T[] {
  return items.filter((item) => item.id !== id)
}

/** Moves the item at `index` by `delta` positions (clamped), returning a new array. */
export function move<T>(items: T[], index: number, delta: number): T[] {
  const target = index + delta
  if (target < 0 || target >= items.length) return items
  const next = [...items]
  const [item] = next.splice(index, 1)
  next.splice(target, 0, item)
  return next
}

/** Groups items by a string key derived from each item, preserving order. */
export function groupBy<T, K extends string>(items: T[], keyOf: (item: T) => K): Record<K, T[]> {
  const groups = {} as Record<K, T[]>
  for (const item of items) {
    const key = keyOf(item)
    ;(groups[key] ??= []).push(item)
  }
  return groups
}
