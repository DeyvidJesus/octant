import type { JobOpportunity } from '@/types/job'
import type { JobAnalysis } from '@/types/analysis'
import type { DiscoveredCandidate } from '@/types/discovery'
import type { MasterResume } from '@/types/resume'
import type { SearchProfile } from '@/types/searchProfile'
import { toCandidates, type ExtractedJob } from '@/services/ai/tasks/extractJobsCore'
import { dedupeCandidates, type DedupeContext } from './dedupe'

/**
 * The continuous-discovery pipeline core. Pure and framework-free: it takes an explicit context
 * (no Zustand, no Supabase) and injected adapters, so it runs identically in the browser and in the
 * Deno worker. Stages: generateStrategies → source.search → toCandidates → dedupe → score → persist
 * (incremental). Enrichment (AI explanation/gaps/recommendation) is a later phase.
 */

/** Below this description length we don't score — a thin snippet can't produce an honest ATS number. */
export const MIN_SCORABLE_DESCRIPTION = 200

export interface DiscoveryStrategy {
  id: string
  /** Human label shown as the candidate's sourceNote, e.g. the target role. */
  label: string
  /** The search query string handed to the source adapter. */
  query: string
  rationale?: string
}

/** A pluggable job source (grounded web search now; job-board APIs / RSS later). */
export interface JobSource {
  readonly id: string
  search(strategy: DiscoveryStrategy, signal?: AbortSignal): Promise<ExtractedJob[]>
}

export interface DiscoveryProgress {
  phase: 'searching' | 'scoring' | 'done'
  strategyLabel?: string
  fresh: number
}

export interface DiscoveryRunStats {
  strategies: number
  found: number
  fresh: number
  duplicates: number
  scored: number
  errors: number
}

export interface RunDiscoveryContext {
  /** The search strategies to execute this run (built by the caller — deterministic or AI). */
  strategies: DiscoveryStrategy[]
  /** For deterministic scoring. */
  resume: MasterResume
  /** Existing board jobs + queue + dismissed keys, for cross-run dedup. */
  dedupe: DedupeContext
  /** Hard cap on fresh candidates persisted per run (cost/queue control). */
  maxCandidates: number
  runId?: string
}

export interface RunDiscoveryDeps {
  source: JobSource
  /** Deterministic analyzer (getAnalyzer().analyze), injected so the core stays pure. */
  analyze: (job: JobOpportunity, resume: MasterResume) => Promise<JobAnalysis>
  /** Called for each fresh, scored candidate — the incremental persistence seam (streams to the feed). */
  onCandidate: (candidate: DiscoveredCandidate) => Promise<void> | void
  onProgress?: (progress: DiscoveryProgress) => void
  signal?: AbortSignal
}

/** Deterministic Phase-1 strategy generation from the structured profile (AI variant lands in Phase 2). */
export function generateStrategies(profile: SearchProfile): DiscoveryStrategy[] {
  const roles = profile.targetRoles.length > 0 ? profile.targetRoles : ['Software Engineer']
  const seniority = profile.seniority !== 'unknown' ? profile.seniority : ''
  const tech = profile.technologies.slice(0, 6).join(', ')
  const locationHint =
    profile.locations.join(' / ') || (profile.workModes.includes('remote') ? 'Remote' : '')

  // One strategy per target role (capped) to diversify coverage without exploding AI calls.
  return roles.slice(0, 3).map((role, index) => ({
    id: `strategy-${index}`,
    label: role,
    query: [seniority, role, tech ? `(${tech})` : '', locationHint, ...profile.includeKeywords]
      .filter(Boolean)
      .join(' ')
      .trim(),
    rationale: `Targets "${role}" using your top skills and location preferences.`,
  }))
}

/** Builds the ephemeral JobOpportunity the analyzer/enrichment reason over (mirrors scoreCandidates). */
export function candidateToEphemeralJob(candidate: DiscoveredCandidate): JobOpportunity {
  return {
    id: candidate.id,
    company: candidate.company,
    role: candidate.role,
    description: candidate.description,
    url: candidate.url,
    salaryRange: candidate.salaryRange,
    location: candidate.location,
    workMode: candidate.workMode,
    tags: [],
    createdAt: candidate.foundAt,
    archived: false,
    source: 'discovered',
  }
}

/**
 * Runs one discovery cycle. Fresh candidates are scored and streamed out via `onCandidate` as they
 * are produced (never a big batch at the end), so the client feed fills incrementally.
 */
export async function runDiscovery(
  ctx: RunDiscoveryContext,
  deps: RunDiscoveryDeps,
): Promise<DiscoveryRunStats> {
  const strategies = ctx.strategies
  const stats: DiscoveryRunStats = { strategies: strategies.length, found: 0, fresh: 0, duplicates: 0, scored: 0, errors: 0 }
  const accumulated: DiscoveredCandidate[] = []

  for (const strategy of strategies) {
    if (accumulated.length >= ctx.maxCandidates) break
    deps.onProgress?.({ phase: 'searching', strategyLabel: strategy.label, fresh: stats.fresh })

    let postings: ExtractedJob[]
    try {
      postings = await deps.source.search(strategy, deps.signal)
    } catch {
      stats.errors += 1
      continue
    }
    stats.found += postings.length

    // Dedup against the board/queue/dismissed set AND everything accepted earlier this run.
    const candidates = toCandidates(postings, 'agent', strategy.label)
    const { fresh, skipped } = dedupeCandidates(candidates, {
      ...ctx.dedupe,
      existingCandidates: [...ctx.dedupe.existingCandidates, ...accumulated],
    })
    stats.duplicates += skipped.asDuplicateOfBoard + skipped.asDuplicateOfQueue + skipped.asDismissed + skipped.withinBatch

    for (const candidate of fresh) {
      if (accumulated.length >= ctx.maxCandidates) break
      candidate.runId = ctx.runId
      candidate.strategyId = strategy.id
      candidate.enrichmentStatus = 'none'

      if (candidate.description.trim().length >= MIN_SCORABLE_DESCRIPTION) {
        deps.onProgress?.({ phase: 'scoring', strategyLabel: strategy.label, fresh: stats.fresh })
        try {
          const analysis = await deps.analyze(candidateToEphemeralJob(candidate), ctx.resume)
          candidate.matchScore = analysis.match.atsScore
          candidate.analysis = analysis
          stats.scored += 1
        } catch {
          stats.errors += 1
        }
      }

      accumulated.push(candidate)
      stats.fresh += 1
      await deps.onCandidate(candidate)
    }
  }

  deps.onProgress?.({ phase: 'done', fresh: stats.fresh })
  return stats
}
