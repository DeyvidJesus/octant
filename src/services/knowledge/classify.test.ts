import { describe, expect, it } from 'vitest'
import type { UnclassifiedFact } from '@/types/resume'
import { classifyFact, emptyFact } from './classify'

const unclassified: UnclassifiedFact = {
  id: 'u1',
  rawText: 'Reduced API response time by 40%',
  source: 'resume-import',
  reason: 'Could not determine fact type automatically',
  status: 'needs_review',
}

describe('classifyFact', () => {
  it('promotes an unclassified note into a typed fact with needs_review status', () => {
    const fact = classifyFact(unclassified, 'achievement')
    expect(fact.type).toBe('achievement')
    expect(fact.statement).toBe(unclassified.rawText)
    expect(fact.status).toBe('needs_review')
  })

  it('generates a new id distinct from the unclassified source', () => {
    const fact = classifyFact(unclassified, 'result')
    expect(fact.id).toBeTruthy()
    expect(fact.id).not.toBe(unclassified.id)
  })

  it('carries provenance from the original source', () => {
    const fact = classifyFact(unclassified, 'action')
    expect(fact.provenance.source).toBe('resume-import')
    expect(fact.provenance.excerpt).toBe(unclassified.rawText)
    expect(fact.provenance.notes).toContain('triage inbox')
  })

  it('initialises all cross-reference arrays as empty', () => {
    const fact = classifyFact(unclassified, 'technical_capability')
    expect(fact.roleIds).toEqual([])
    expect(fact.initiativeIds).toEqual([])
    expect(fact.skillIds).toEqual([])
    expect(fact.metricIds).toEqual([])
    expect(fact.tags).toEqual([])
  })
})

describe('emptyFact', () => {
  it('creates a blank manual fact with todo status', () => {
    const fact = emptyFact()
    expect(fact.id).toBeTruthy()
    expect(fact.type).toBe('achievement')
    expect(fact.status).toBe('todo')
    expect(fact.statement).toBe('')
    expect(fact.provenance.source).toBe('manual')
  })

  it('generates a unique id each call', () => {
    const a = emptyFact()
    const b = emptyFact()
    expect(a.id).not.toBe(b.id)
  })
})
