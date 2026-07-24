import type { DiscoveryRunTrigger } from '@/types/discovery'
import { useJobsStore } from '@/stores/jobsStore'
import { useDiscoveryStore } from '@/stores/discoveryStore'
import { useResumeStore } from '@/stores/resumeStore'
import { useSearchProfileStore } from '@/stores/searchProfileStore'
import { useSubscriptionStore } from '@/stores/subscriptionStore'
import { discoveryRepository } from '@/repositories/DiscoveryRepository'
import { getAnalyzer } from '@/services/analysis/localHeuristicAnalyzer'
import { getProvider } from '@/services/ai/providers'
import { AnalyticsEvent, trackEvent } from '@/services/analytics/analytics'
import { resolveAiRunConfig } from '@/stores/settingsStore'
import type { DiscoveredCandidate } from '@/types/discovery'
import type { MasterResume } from '@/types/resume'
import { resolveSearchProfile } from './deriveSearchProfile'
import { isDueForRun } from './cadence'
import { runDiscovery } from './pipeline'
import { generateStrategiesWithAi } from './strategies'
import { applyLearnedToProfile } from './signals'
import { enrichCandidate, type EnrichCompleteFn } from './enrich'
import { createGroundedGeminiSource, GEMINI_DISCOVERY_MODEL } from './sources/groundedGemini'

/** Only the top-K new candidates per run get an AI explanation — controls cost (rest are on-demand). */
const ENRICH_TOP_K = 5

/** Client enrichment transport: the reasoning provider via ai-proxy (budget enforced server-side). */
const clientEnrichComplete: EnrichCompleteFn = async (system, user) => {
  const config = resolveAiRunConfig()
  const result = await getProvider(config.providerId).complete({
    model: config.model,
    apiKey: config.apiKey,
    baseUrl: config.baseUrl,
    temperature: 0.4,
    maxTokens: 700,
    messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
  })
  return result.text
}

/** Enriches one candidate on demand (card "Explain fit"), persisting + streaming the result. */
export async function enrichOneCandidate(candidate: DiscoveredCandidate): Promise<void> {
  const resume = useResumeStore.getState().resume
  const patch = await enrichCandidate(candidate, resume, clientEnrichComplete)
  const patched = { ...candidate, ...patch }
  useDiscoveryStore.getState().receiveCandidate(patched)
  await discoveryRepository.updateCandidateData(patched).catch(() => {})
}

/** Enriches the highest-scoring fresh candidates (top-K), persisting + streaming each. */
async function enrichTopK(candidates: DiscoveredCandidate[], resume: MasterResume): Promise<void> {
  const targets = candidates
    .filter((c) => c.analysis && c.enrichmentStatus !== 'done')
    .sort((a, b) => (b.matchScore ?? -1) - (a.matchScore ?? -1))
    .slice(0, ENRICH_TOP_K)
  for (const candidate of targets) {
    const patch = await enrichCandidate(candidate, resume, clientEnrichComplete)
    const patched = { ...candidate, ...patch }
    useDiscoveryStore.getState().receiveCandidate(patched)
    await discoveryRepository.updateCandidateData(patched).catch(() => {})
  }
}

/** Gemini strategy-generation completion (via ai-proxy). Falls back deterministically on failure. */
async function geminiComplete(prompt: string, opts?: { temperature?: number; maxTokens?: number }): Promise<string> {
  const result = await getProvider('gemini').complete({
    model: GEMINI_DISCOVERY_MODEL,
    messages: [{ role: 'user', content: prompt }],
    temperature: opts?.temperature,
    maxTokens: opts?.maxTokens,
  })
  return result.text
}

/** Cost/queue guard: cap fresh candidates persisted per in-session run. */
const MAX_CANDIDATES_PER_RUN = 30

/** One in-session run at a time (a session heartbeat and a manual click can't overlap). */
let inFlight = false

export function isDiscoveryRunning(): boolean {
  return inFlight
}

/**
 * The "in-session" half of the hybrid model: when the app is open, quietly advance discovery if the
 * user is due per their plan cadence — so the agent feels continuously at work without a manual click.
 * Cadence-gated (free 24h / pro 1h) and skipped for empty profiles, so cost stays bounded.
 */
export function maybeRunSessionHeartbeat(): void {
  if (inFlight) return
  const kb = useResumeStore.getState().knowledgeBase
  const resolved = resolveSearchProfile(useSearchProfileStore.getState().profile, kb)
  if (resolved.targetRoles.length === 0) return // nothing to search for yet
  const tier = useSubscriptionStore.getState().tier
  const lastFinished = useDiscoveryStore.getState().currentRun?.finishedAt ?? null
  if (!isDueForRun(lastFinished, tier, Date.now())) return
  void runInSessionDiscovery('session')
}

/**
 * Runs one discovery cycle client-side (the "in-session" half of the hybrid model): the shared pure
 * `runDiscovery` core with a grounded-Gemini source, deterministic scoring, and incremental
 * persistence. Each fresh candidate is written to `discovered_jobs` as it is produced and streams
 * back into the feed via realtime. Per-user AI budget is enforced server-side by `ai-proxy`.
 */
export async function runInSessionDiscovery(trigger: DiscoveryRunTrigger = 'manual'): Promise<void> {
  if (inFlight) return
  inFlight = true

  const discovery = useDiscoveryStore.getState()
  const kb = useResumeStore.getState().knowledgeBase
  const resume = useResumeStore.getState().resume
  const profile = resolveSearchProfile(useSearchProfileStore.getState().profile, kb)
  const analyzer = getAnalyzer()

  let runId: string | null = null
  try {
    runId = await discoveryRepository.createRun(trigger)
  } catch {
    // The runs table is best-effort; discovery still works without a persisted run row.
  }
  discovery.setProgress({ phase: 'searching', fresh: 0 })
  trackEvent(AnalyticsEvent.DiscoveryRunStarted, { trigger })

  try {
    // Bias the profile with what we've learned from the user's past reactions, then generate diverse
    // strategies (deterministic fallback on any failure).
    const learnedProfile = applyLearnedToProfile(profile, useDiscoveryStore.getState().learnedPreferences)
    const strategies = await generateStrategiesWithAi(learnedProfile, geminiComplete)

    const freshThisRun: DiscoveredCandidate[] = []
    const stats = await runDiscovery(
      {
        strategies,
        resume,
        dedupe: {
          existingJobs: useJobsStore.getState().jobs.map((j) => ({ company: j.company, role: j.role, url: j.url })),
          existingCandidates: discovery.candidates,
          dismissedKeys: discovery.dismissedKeys,
        },
        maxCandidates: MAX_CANDIDATES_PER_RUN,
        runId: runId ?? undefined,
      },
      {
        source: createGroundedGeminiSource(),
        analyze: (job, r) => analyzer.analyze({ job, resume: r }),
        onCandidate: async (candidate) => {
          // Optimistic local upsert (idempotent) + persist; realtime echo is absorbed by id.
          useDiscoveryStore.getState().receiveCandidate(candidate)
          freshThisRun.push(candidate)
          await discoveryRepository.insertCandidates([candidate])
        },
        onProgress: (p) => useDiscoveryStore.getState().setProgress(p),
      },
    )

    // Intelligence: enrich the top-K most relevant new candidates with a grounded explanation +
    // recommendation. Cost-bounded; the rest can be enriched on demand from the card.
    await enrichTopK(freshThisRun, resume)

    useDiscoveryStore.getState().markSweepRan()
    if (runId) {
      await discoveryRepository.updateRun(runId, {
        status: stats.errors > 0 && stats.fresh === 0 ? 'failed' : stats.errors > 0 ? 'partial' : 'succeeded',
        stats,
        finishedAt: new Date().toISOString(),
      })
    }
    trackEvent(AnalyticsEvent.DiscoveryRunCompleted, { fresh: stats.fresh, scored: stats.scored })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Discovery run failed.'
    if (runId) {
      await discoveryRepository
        .updateRun(runId, { status: 'failed', error: message, finishedAt: new Date().toISOString() })
        .catch(() => {})
    }
  } finally {
    useDiscoveryStore.getState().setProgress(null)
    inFlight = false
  }
}
