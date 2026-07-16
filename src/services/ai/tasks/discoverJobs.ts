import type { DiscoveryPrefs } from '@/types/discovery'
import type { MasterResume } from '@/types/resume'
import { providerSupportsWebSearch } from '../registry'
import { getProvider } from '../providers'
import { AiError, type AiRunConfig } from '../types'
import { extractJobs, type ExtractJobsResult } from './extractJobs'

/**
 * The in-app job sweep: a cheap search-grounded completion produces a plain
 * text report of real, current openings; the report then goes through the same
 * deterministic extraction seam as a pasted Deep Research report. Grounding
 * and structured output are incompatible, so this two-step split is required —
 * and it keeps a single validation path for every discovery source.
 */

export interface SweepQuery {
  prefs: DiscoveryPrefs
  resumeFacts: {
    role: string
    topSkills: string[]
    goals: string
    location: string
  }
}

/** Distill the Master Resume into the facts a sweep prompt needs. */
export function buildResumeFacts(resume: MasterResume): SweepQuery['resumeFacts'] {
  return {
    role: resume.personal.role,
    topSkills: resume.skills.slice(0, 15).map((skill) => skill.canonical),
    goals: resume.goals,
    location: resume.personal.location,
  }
}

function buildBrief({ prefs, resumeFacts }: SweepQuery): string {
  return [
    `CANDIDATE: ${resumeFacts.role}, based in ${resumeFacts.location}. Key skills: ${resumeFacts.topSkills.join(', ')}.`,
    resumeFacts.goals && `CAREER GOALS: ${resumeFacts.goals}`,
    prefs.targetRoles && `TARGET ROLES: ${prefs.targetRoles}`,
    prefs.regions && `REGIONS / WORK MODE: ${prefs.regions}`,
    prefs.seniority && `SENIORITY: ${prefs.seniority}`,
    prefs.extraInstructions && `ADDITIONAL INSTRUCTIONS: ${prefs.extraInstructions}`,
  ]
    .filter(Boolean)
    .join('\n')
}

/** Exported for testing. */
export function buildSweepPrompt(query: SweepQuery): string {
  return [
    'Search the web for currently open job postings matching this candidate.',
    '',
    buildBrief(query),
    '',
    'Find 5–12 REAL, currently-open postings — prefer ones published in the last 7 days.',
    'For each: company, exact role title, the direct posting URL from your search results,',
    'location/work mode, salary if listed, and a 2–4 sentence summary of requirements and stack.',
    'Quality over quantity: only include roles this candidate could credibly apply to.',
    'Respond as a plain text report.',
  ].join('\n')
}

/** The same brief expanded for a long-running Deep Research agent. */
export function buildResearchPrompt(query: SweepQuery): string {
  return [
    'Research currently open job postings matching this candidate.',
    '',
    buildBrief(query),
    '',
    'Be exhaustive: cover company career pages, Greenhouse/Lever/Ashby boards, and remote-friendly',
    'job boards, not just aggregators. Verify each posting appears to still be open. Include',
    'compensation data when available and note visa/location constraints for international remote',
    'candidates. Only include roles this candidate could credibly apply to — quality over quantity.',
    '',
    'End the report with a clearly delimited section titled "JOB LISTINGS" containing, for each',
    'posting: company, exact role title, the direct posting URL, location/work mode, salary if',
    'listed, and a summary of requirements and stack.',
  ].join('\n')
}

export interface SweepResult {
  reportText: string
  extraction: ExtractJobsResult
}

export async function sweepJobs(
  query: SweepQuery,
  config: AiRunConfig,
  signal?: AbortSignal,
): Promise<SweepResult> {
  if (!providerSupportsWebSearch(config.providerId)) {
    throw new AiError(
      'The active AI provider cannot search the web. Switch to a search-capable provider in Settings, or paste a research report instead.',
    )
  }

  const provider = getProvider(config.providerId)
  const grounded = await provider.complete({
    model: config.model,
    apiKey: config.apiKey,
    baseUrl: config.baseUrl,
    temperature: 0.3,
    maxTokens: 3000,
    webSearch: true,
    signal,
    messages: [
      { role: 'system', content: 'You are a job-search researcher for a software engineer. You only report real postings found via web search — never from memory.' },
      { role: 'user', content: buildSweepPrompt(query) },
    ],
  })

  const extraction = await extractJobs(grounded.text, config, signal)
  return { reportText: grounded.text, extraction }
}
