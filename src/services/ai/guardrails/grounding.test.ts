import { describe, it, expect } from 'vitest'
import { checkGrounding } from './grounding'

describe('checkGrounding', () => {
  it('passes when the text only names known skills', () => {
    const known = new Set(['React', 'TypeScript', 'Node.js'])
    const report = checkGrounding('Strong React and TypeScript work on a Node.js backend.', known)
    expect(report.ok).toBe(true)
    expect(report.unverifiedSkills).toEqual([])
  })

  it('flags a technology the resume and job never mentioned', () => {
    const known = new Set(['React'])
    const report = checkGrounding('Great React skills plus deep Kubernetes experience.', known)
    expect(report.ok).toBe(false)
    expect(report.unverifiedSkills).toContain('Kubernetes')
  })

  it('dedupes a repeated invented skill', () => {
    const report = checkGrounding('Rust here, Rust there, Rust everywhere.', new Set<string>())
    expect(report.unverifiedSkills).toEqual(['Rust'])
  })

  it('treats prose with no skills as grounded', () => {
    const report = checkGrounding('A strong communicator who ships reliably.', new Set(['React']))
    expect(report.ok).toBe(true)
  })
})
