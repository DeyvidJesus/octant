import { describe, expect, it } from 'vitest'
import { groupBy, move, removeById, updateById } from './collections'

describe('groupBy', () => {
  it('groups items by a derived key, preserving order', () => {
    const items = [
      { id: 'a', stage: 'applied' },
      { id: 'b', stage: 'offer' },
      { id: 'c', stage: 'applied' },
    ]
    const grouped = groupBy(items, (item) => item.stage)
    expect(grouped.applied.map((i) => i.id)).toEqual(['a', 'c'])
    expect(grouped.offer.map((i) => i.id)).toEqual(['b'])
  })

  it('returns an empty object for no items', () => {
    expect(groupBy([] as { id: string; k: string }[], (i) => i.k)).toEqual({})
  })
})

describe('existing collection helpers still work', () => {
  const items = [{ id: 'a' }, { id: 'b' }, { id: 'c' }]

  it('updateById patches the matching item immutably', () => {
    const next = updateById(items, 'b', { id: 'b' })
    expect(next).not.toBe(items)
    expect(next.map((i) => i.id)).toEqual(['a', 'b', 'c'])
  })

  it('removeById drops the matching item', () => {
    expect(removeById(items, 'b').map((i) => i.id)).toEqual(['a', 'c'])
  })

  it('move reorders within bounds and clamps out of range', () => {
    expect(move(items, 0, 1).map((i) => i.id)).toEqual(['b', 'a', 'c'])
    expect(move(items, 0, -1)).toBe(items)
  })
})
