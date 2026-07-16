import { describe, it, expect, vi, beforeEach } from 'vitest'
import { buildSweepPrompt, buildResearchPrompt, sweepJobs, type SweepQuery } from './discoverJobs'
import { AiError, type CompletionResult } from '../types'
import { getProvider } from '../providers'

vi.mock('../providers', () => ({
  getProvider: vi.fn(),
}))

const query: SweepQuery = {
  prefs: {
    targetRoles: 'Software Engineer, Product Engineer',
    regions: 'Remote — US, Europe',
    seniority: 'mid-level',
    extraInstructions: 'Prefer product companies.',
    staleReminder: false,
  },
  resumeFacts: {
    role: 'Software Engineer',
    topSkills: ['React', 'TypeScript', 'Node.js'],
    goals: 'International remote role.',
    location: 'Brazil',
  },
}

describe('buildSweepPrompt / buildResearchPrompt', () => {
  it('includes prefs and resume facts', () => {
    const prompt = buildSweepPrompt(query)
    expect(prompt).toContain('Software Engineer, Product Engineer')
    expect(prompt).toContain('Remote — US, Europe')
    expect(prompt).toContain('mid-level')
    expect(prompt).toContain('React, TypeScript, Node.js')
    expect(prompt).toContain('International remote role.')
    expect(prompt).toContain('Prefer product companies.')
  })

  it('omits empty pref lines', () => {
    const prompt = buildSweepPrompt({ ...query, prefs: { ...query.prefs, targetRoles: '', seniority: '' } })
    expect(prompt).not.toContain('TARGET ROLES')
    expect(prompt).not.toContain('SENIORITY')
  })

  it('research prompt asks for exhaustive coverage and a delimited listing section', () => {
    const prompt = buildResearchPrompt(query)
    expect(prompt).toContain('JOB LISTINGS')
    expect(prompt).toContain('Greenhouse/Lever/Ashby')
  })
})

describe('sweepJobs', () => {
  beforeEach(() => {
    vi.mocked(getProvider).mockReset()
  })

  it('throws for providers without web search capability', async () => {
    await expect(
      sweepJobs(query, { providerId: 'claude', model: 'claude-opus-4-8', apiKey: 'k' }),
    ).rejects.toThrow(AiError)
  })

  it('runs the two-step flow: grounded report, then extraction', async () => {
    const complete = vi
      .fn()
      // Step 1: the grounded report.
      .mockResolvedValueOnce({
        text: 'Report: Acme is hiring an Engineer. Apply at https://acme.com/jobs/1',
        model: 'gemini-2.0-flash',
        providerId: 'gemini',
      } satisfies CompletionResult)
      // Step 2: the extraction pass.
      .mockResolvedValueOnce({
        text: JSON.stringify([{ company: 'Acme', role: 'Engineer', description: 'desc', workMode: 'remote' }]),
        model: 'gemini-2.0-flash',
        providerId: 'gemini',
      } satisfies CompletionResult)
    vi.mocked(getProvider).mockReturnValue({ id: 'gemini', complete })

    const result = await sweepJobs(query, { providerId: 'gemini', model: 'gemini-2.0-flash', apiKey: 'k' })

    expect(result.extraction.jobs).toHaveLength(1)
    expect(complete).toHaveBeenCalledTimes(2)
    // First call is grounded; second (extraction) is not.
    expect(complete.mock.calls[0][0].webSearch).toBe(true)
    expect(complete.mock.calls[1][0].webSearch).toBeUndefined()
    // The extraction pass received the report text.
    expect(complete.mock.calls[1][0].messages.at(-1)?.content).toContain('Acme is hiring')
  })
})
