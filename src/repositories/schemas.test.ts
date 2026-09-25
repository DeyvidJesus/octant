import { describe, expect, it } from 'vitest'
import type { Application } from '@/types/application'
import type { DiscoveredCandidate } from '@/types/discovery'
import type { JobOpportunity } from '@/types/job'
import { applicationSchema, discoveredCandidateSchema, jobAnalysisSchema, jobSchema, parseDocuments } from './schemas'

const job = { id: 'j1', company: 'Acme', role: 'Engineer', description: 'Build UIs', tags: ['react'], archived: false }

describe('parseDocuments', () => {
  it('repairs documents missing optional-looking arrays instead of crashing the UI later', () => {
    const { valid, rejected } = parseDocuments<Application>(
      [{ id: 'a1', company: 'Acme', role: 'Engineer', stage: 'applied' }],
      applicationSchema,
    )
    expect(rejected).toEqual([])
    expect(valid[0].events).toEqual([])
    expect(valid[0].links).toEqual([])
    expect(valid[0].notes).toBe('')
  })

  it('falls back to a safe value for an unknown enum', () => {
    const { valid } = parseDocuments<Application>(
      [{ id: 'a1', company: 'Acme', role: 'Engineer', stage: 'teleported', events: [] }],
      applicationSchema,
    )
    expect(valid[0].stage).toBe('saved')
  })

  it('drops documents without identity or core fields and reports why, without their content', () => {
    const { valid, rejected } = parseDocuments<JobOpportunity>(
      [job, { company: 'No id', role: 'x' }, null, 'garbage', { id: 'j2', role: 'Engineer', description: 'secret' }],
      jobSchema,
    )
    expect(valid.map((j) => j.id)).toEqual(['j1'])
    expect(rejected.map((r) => r.index)).toEqual([1, 2, 3, 4])
    expect(rejected[3]).toEqual({ index: 4, id: 'j2', issues: [expect.stringContaining('company')] })
    expect(JSON.stringify(rejected)).not.toContain('secret')
  })

  it('keeps fields the schema does not know about', () => {
    const { valid } = parseDocuments<JobOpportunity & { futureField: string }>([{ ...job, futureField: 'kept' }], jobSchema)
    expect(valid[0].futureField).toBe('kept')
  })

  it('keeps a candidate whose nested analysis is malformed, without the analysis', () => {
    const candidate = { id: 'c1', company: 'Acme', role: 'Engineer', analysis: { jobId: 'c1', match: 'broken' } }
    const { valid, rejected } = parseDocuments<DiscoveredCandidate>([candidate], discoveredCandidateSchema)
    expect(rejected).toEqual([])
    expect(valid[0].analysis).toBeUndefined()
  })

  it('replaces an out-of-range score with 0 instead of rendering a broken meter', () => {
    const analysis = { jobId: 'j1', match: { atsScore: 740, matched: ['react'] } }
    const { valid } = parseDocuments<{ match: { atsScore: number; missing: string[] } }>([analysis], jobAnalysisSchema)
    expect(valid[0].match.atsScore).toBe(0)
    expect(valid[0].match.missing).toEqual([])
  })
})
