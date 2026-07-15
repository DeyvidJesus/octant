import { describe, it, expect } from 'vitest'
import { extractSkills, detectSeniority } from './extract'

describe('extractSkills', () => {
  it('detects taxonomy skills by alias, case-insensitively', () => {
    const hits = extractSkills('We use TS and ReactJS with a Node.js backend.')
    const canonicals = hits.map((h) => h.entry.canonical)
    expect(canonicals).toContain('TypeScript')
    expect(canonicals).toContain('React')
    expect(canonicals).toContain('Node.js')
  })

  it('counts frequency and sorts most-frequent first', () => {
    const hits = extractSkills('React React React. TypeScript once.')
    expect(hits[0].entry.canonical).toBe('React')
    expect(hits[0].count).toBe(3)
  })

  it('classifies skills under a "nice to have" heading as preferred', () => {
    const jd = `Requirements:
      - Strong React and TypeScript
      Nice to have:
      - Rust
      - Docker`
    const byName = Object.fromEntries(extractSkills(jd).map((h) => [h.entry.canonical, h.importance]))
    expect(byName['React']).toBe('required')
    expect(byName['TypeScript']).toBe('required')
    expect(byName['Rust']).toBe('preferred')
    expect(byName['Docker']).toBe('preferred')
  })

  it('classifies inline "a plus" markers as preferred', () => {
    const byName = Object.fromEntries(
      extractSkills('You will use React daily. Kubernetes experience is a plus.').map((h) => [
        h.entry.canonical,
        h.importance,
      ]),
    )
    expect(byName['React']).toBe('required')
    expect(byName['Kubernetes']).toBe('preferred')
  })

  it('treats a skill named in both contexts as required', () => {
    const jd = 'Requirements: React. Nice to have: more React practice.'
    const react = extractSkills(jd).find((h) => h.entry.canonical === 'React')
    expect(react?.importance).toBe('required')
  })

  it('does not match substrings across token boundaries', () => {
    // "javascripting" should not count as JavaScript
    const hits = extractSkills('We love javascripting our tests')
    expect(hits.map((h) => h.entry.canonical)).not.toContain('JavaScript')
  })
})

describe('detectSeniority', () => {
  it('detects senior from an explicit token', () => {
    expect(detectSeniority('Senior Software Engineer').level).toBe('senior')
  })

  it('infers senior from 5+ years', () => {
    const result = detectSeniority('Looking for someone with 5+ years of experience')
    expect(result.level).toBe('senior')
    expect(result.evidence.join(' ')).toContain('5+ years')
  })

  it('prefers the explicit token over the years signal', () => {
    expect(detectSeniority('Staff engineer with 3 years experience').level).toBe('staff')
  })

  it('returns unknown when no signal is present', () => {
    expect(detectSeniority('Join our team of builders').level).toBe('unknown')
  })
})
