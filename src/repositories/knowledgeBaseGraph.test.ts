import { describe, expect, it } from 'vitest'
import type { CareerKnowledgeBase } from '@/types/resume'
import { createSeedKnowledgeBase } from '@/test/fixtures/sampleCareer'
import {
  assembleKnowledgeBase,
  diffById,
  residualChanged,
  splitKnowledgeBase,
} from './knowledgeBaseGraph'

describe('splitKnowledgeBase / assembleKnowledgeBase', () => {
  it('round-trips a knowledge base without loss', () => {
    const kb = createSeedKnowledgeBase()
    const { organizations, roles, skills, facts, residual } = splitKnowledgeBase(kb)
    const rebuilt = assembleKnowledgeBase(residual, { organizations, roles, skills, facts })
    expect(rebuilt).toEqual(kb)
  })

  it('keeps the four normalized collections out of the residual', () => {
    const { residual } = splitKnowledgeBase(createSeedKnowledgeBase())
    expect(residual).not.toHaveProperty('organizations')
    expect(residual).not.toHaveProperty('roles')
    expect(residual).not.toHaveProperty('skills')
    expect(residual).not.toHaveProperty('facts')
    // Residual still carries the non-normalized collections + profile + meta.
    expect(residual).toHaveProperty('profile')
    expect(residual).toHaveProperty('initiatives')
    expect(residual).toHaveProperty('metrics')
    expect(residual).toHaveProperty('updatedAt')
  })
})

describe('diffById', () => {
  const a = { id: 'a', v: 1 }
  const b = { id: 'b', v: 2 }
  const c = { id: 'c', v: 3 }

  it('upserts only changed rows and leaves unchanged rows alone', () => {
    const changedB = { id: 'b', v: 99 }
    const { upserts, deleteIds } = diffById([a, b, c], [a, changedB, c])
    expect(upserts).toEqual([changedB])
    expect(deleteIds).toEqual([])
  })

  it('detects a single new row', () => {
    const { upserts, deleteIds } = diffById([a], [a, b])
    expect(upserts).toEqual([b])
    expect(deleteIds).toEqual([])
  })

  it('detects removed rows by id', () => {
    const { upserts, deleteIds } = diffById([a, b, c], [a, c])
    expect(upserts).toEqual([])
    expect(deleteIds).toEqual(['b'])
  })

  it('returns nothing to write when collections are identical', () => {
    const { upserts, deleteIds } = diffById([a, b, c], [a, b, c])
    expect(upserts).toEqual([])
    expect(deleteIds).toEqual([])
  })

  it('handles first-write (empty baseline) as all-upserts', () => {
    const { upserts, deleteIds } = diffById([], [a, b, c])
    expect(upserts).toEqual([a, b, c])
    expect(deleteIds).toEqual([])
  })

  it('is insensitive to key ordering within an unchanged row', () => {
    const prev = [{ id: 'a', x: 1, y: 2 }]
    const next = [{ id: 'a', x: 1, y: 2 }]
    expect(diffById(prev, next).upserts).toEqual([])
  })
})

describe('residualChanged', () => {
  const base = (): CareerKnowledgeBase => createSeedKnowledgeBase()

  it('ignores an updatedAt-only change (a pure fact edit)', () => {
    const prev = splitKnowledgeBase(base()).residual
    const next = { ...prev, updatedAt: '2099-01-01T00:00:00.000Z' }
    expect(residualChanged(prev, next)).toBe(false)
  })

  it('detects a change to a residual collection', () => {
    const prev = splitKnowledgeBase(base()).residual
    const next = { ...prev, metrics: [], updatedAt: '2099-01-01T00:00:00.000Z' }
    expect(residualChanged(prev, next)).toBe(true)
  })

  it('is false for an identical residual', () => {
    const prev = splitKnowledgeBase(base()).residual
    expect(residualChanged(prev, { ...prev })).toBe(false)
  })
})
