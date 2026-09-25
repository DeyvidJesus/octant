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
import { resolveSearchProfile } from '@/services/discovery/deriveSearchProfile'
import { isDueForRun } from '@/services/discovery/cadence'
import { runDiscovery } from '@/services/discovery/pipeline'
import { generateStrategiesWithAi } from '@/services/discovery/strategies'
import { applyLearnedToProfile } from '@/services/discovery/signals'
import { enrichCandidate, type EnrichCompleteFn } from '@/services/discovery/enrich'
import { createGroundedGeminiSource, GEMINI_DISCOVERY_MODEL } from '@/services/discovery/sources/groundedGemini'

/** Only the top-K new candidates per run are AI-enriched, to bound cost; the rest are on demand. */
const ENRICH_TOP_K = 5

/** Enrichment completion via ai-proxy, which enforces the AI budget. */
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

/** Enriches one candidate on demand ("Explain fit") and persists the result. */
export async function enrichOneCandidate(candidate: DiscoveredCandidate): Promise<void> {
  const resume = useResumeStore.getState().resume
  const patch = await enrichCandidate(candidate, resume, clientEnrichComplete)
  const patched = { ...candidate, ...patch }
  useDiscoveryStore.getState().receiveCandidate(patched)
  await discoveryRepository.updateCandidateData(patched).catch(() => {})
}

/** Enriches and persists the top-K fresh candidates. */
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

/** Gemini completion for search strategies (via ai-proxy). */
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

/** Runs discovery while the app is open when the plan cadence says it is due (free 24h, pro 1h). */
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

/** Runs one client-side discovery cycle, writing each fresh candidate to `discovered_jobs` as it arrives. */
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
    // Bias the profile with learned preferences; strategy generation falls back deterministically.
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
          // Optimistic upsert; the realtime echo is absorbed by id.
          useDiscoveryStore.getState().receiveCandidate(candidate)
          freshThisRun.push(candidate)
          await discoveryRepository.insertCandidates([candidate])
        },
        onProgress: (p) => useDiscoveryStore.getState().setProgress(p),
      },
    )

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
