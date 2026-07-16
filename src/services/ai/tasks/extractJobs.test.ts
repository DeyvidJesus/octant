import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  parseJobsJson,
  coerceWorkMode,
  normalizeCandidates,
  buildExtractPrompt,
  extractJobs,
  toCandidates,
} from './extractJobs'
import { AiError, type CompletionResult } from '../types'
import { getProvider } from '../providers'

vi.mock('../providers', () => ({
  getProvider: vi.fn(),
}))

const config = { providerId: 'claude' as const, model: 'test-model', apiKey: 'k' }

function mockCompletions(...texts: string[]) {
  const complete = vi.fn()
  for (const text of texts) {
    complete.mockResolvedValueOnce({ text, model: 'test-model', providerId: 'claude' } satisfies CompletionResult)
  }
  vi.mocked(getProvider).mockReturnValue({ id: 'claude', complete })
  return complete
}

const VALID_JOB = { company: 'Acme', role: 'Engineer', description: 'React role', workMode: 'remote' }

describe('parseJobsJson', () => {
  it('parses a clean array', () => {
    expect(parseJobsJson('[{"a":1}]')).toEqual([{ a: 1 }])
  })

  it('parses a fenced array', () => {
    expect(parseJobsJson('```json\n[{"a":1}]\n```')).toEqual([{ a: 1 }])
  })

  it('parses an array wrapped in prose', () => {
    expect(parseJobsJson('Here are the jobs:\n[{"a":1}]\nHope that helps!')).toEqual([{ a: 1 }])
  })

  it('throws when no array is present', () => {
    expect(() => parseJobsJson('There are no jobs.')).toThrow()
    expect(() => parseJobsJson('{"a":1}')).toThrow()
  })
})

describe('coerceWorkMode', () => {
  it.each([
    ['remote', 'remote'],
    ['Remote (US)', 'remote'],
    ['HYBRID', 'hybrid'],
    ['On-site, NYC', 'onsite'],
    ['in office', 'onsite'],
    ['flexible', 'unknown'],
    [null, 'unknown'],
    [42, 'unknown'],
  ])('%s → %s', (input, expected) => {
    expect(coerceWorkMode(input)).toBe(expected)
  })
})

describe('normalizeCandidates', () => {
  it('keeps valid entries and cleans optionals', () => {
    const { jobs, warnings } = normalizeCandidates([
      {
        company: '  Acme ',
        role: 'Engineer',
        description: 'desc',
        url: 'https://a.com/jobs/1',
        location: '  ',
        salaryRange: '$100k',
        workMode: 'remote',
      },
    ])
    expect(warnings).toEqual([])
    expect(jobs[0]).toEqual({
      company: 'Acme',
      role: 'Engineer',
      description: 'desc',
      url: 'https://a.com/jobs/1',
      location: undefined,
      salaryRange: '$100k',
      workMode: 'remote',
    })
  })

  it('drops entries missing company or role, with a warning', () => {
    const { jobs, warnings } = normalizeCandidates([{ company: 'Acme' }, { role: 'Engineer' }, VALID_JOB])
    expect(jobs).toHaveLength(1)
    expect(warnings[0]).toContain('2 entries dropped')
  })

  it('drops invalid and non-http urls', () => {
    const { jobs } = normalizeCandidates([
      { ...VALID_JOB, url: 'not a url' },
      { ...VALID_JOB, role: 'Other', url: 'javascript:alert(1)' },
    ])
    expect(jobs[0].url).toBeUndefined()
    expect(jobs[1].url).toBeUndefined()
  })

  it('caps the batch at 50', () => {
    const raw = Array.from({ length: 60 }, (_, i) => ({ ...VALID_JOB, role: `Engineer ${i}` }))
    const { jobs, warnings } = normalizeCandidates(raw)
    expect(jobs).toHaveLength(50)
    expect(warnings.some((w) => w.includes('Capped'))).toBe(true)
  })
})

describe('extractJobs', () => {
  beforeEach(() => {
    vi.mocked(getProvider).mockReset()
  })

  it('extracts jobs from a valid first response', async () => {
    mockCompletions(JSON.stringify([VALID_JOB]))
    const result = await extractJobs('report text', config)
    expect(result.jobs).toHaveLength(1)
    expect(result.jobs[0].company).toBe('Acme')
  })

  it('retries once on malformed JSON, then succeeds', async () => {
    const complete = mockCompletions('Sure! The jobs are great.', JSON.stringify([VALID_JOB]))
    const result = await extractJobs('report text', config)
    expect(result.jobs).toHaveLength(1)
    expect(complete).toHaveBeenCalledTimes(2)
    // The retry conversation includes the bad output and the correction.
    const retryMessages = complete.mock.calls[1][0].messages
    expect(retryMessages.at(-2)?.role).toBe('assistant')
    expect(retryMessages.at(-1)?.content).toContain('ONLY the JSON array')
  })

  it('fails with a friendly AiError after two malformed responses', async () => {
    mockCompletions('nope', 'still nope')
    await expect(extractJobs('report text', config)).rejects.toThrow(AiError)
  })

  it('treats an empty array as a valid no-jobs result', async () => {
    mockCompletions('[]')
    const result = await extractJobs('report text', config)
    expect(result.jobs).toEqual([])
    expect(result.warnings).toEqual([])
  })

  it('truncates oversized reports with a warning', async () => {
    const complete = mockCompletions('[]')
    const result = await extractJobs('x'.repeat(70_000), config)
    expect(result.warnings.some((w) => w.includes('truncated'))).toBe(true)
    const sent = complete.mock.calls[0][0].messages.at(-1)?.content ?? ''
    expect(sent.length).toBeLessThan(70_000)
  })
})

describe('toCandidates', () => {
  it('wraps jobs with provenance', () => {
    const [candidate] = toCandidates(
      [{ company: 'Acme', role: 'Engineer', description: '', workMode: 'remote' }],
      'paste',
      'claude · test-model',
    )
    expect(candidate.origin).toBe('paste')
    expect(candidate.sourceNote).toBe('claude · test-model')
    expect(candidate.id).toBeTruthy()
    expect(candidate.foundAt).toBeTruthy()
  })
})

describe('buildExtractPrompt', () => {
  it('embeds the report', () => {
    expect(buildExtractPrompt('THE REPORT')).toContain('THE REPORT')
  })
})
