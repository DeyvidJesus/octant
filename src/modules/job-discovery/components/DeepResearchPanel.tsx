import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { FlaskConical, KeyRound, Loader2, Square } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import type { AiRunConfig } from '@/services/ai/types'
import {
  startDeepResearch,
  awaitDeepResearch,
  resolveDeepResearchConfig,
  DEEP_RESEARCH_HINT,
  type DeepResearchProgress,
} from '@/services/ai/deepResearch'
import { buildResearchPrompt, buildResumeFacts } from '@/services/ai/tasks/discoverJobs'
import { useSettingsStore } from '@/stores/settingsStore'
import { useResumeStore } from '@/stores/resumeStore'
import { useDiscoveryStore } from '@/stores/discoveryStore'
import { ingestReport, formatIngestSummary, hasSkips, type IngestSummary } from '../ingestReport'

/**
 * The exhaustive (paid) path: an in-app Deep Research run. Long-lived and
 * resumable — the interaction id is persisted so a reload can pick the run
 * back up mid-flight. Extraction still needs the active provider config.
 */
export function DeepResearchPanel({ config }: { config: AiRunConfig | null }) {
  const prefs = useSettingsStore((state) => state.discovery)
  const apiKeys = useSettingsStore((state) => state.apiKeys)
  const resume = useResumeStore((state) => state.resume)
  const pendingInteractionId = useDiscoveryStore((state) => state.pendingInteractionId)
  const setPendingInteraction = useDiscoveryStore((state) => state.setPendingInteraction)

  const [phase, setPhase] = useState<'idle' | 'researching' | 'extracting'>('idle')
  const [progress, setProgress] = useState<DeepResearchProgress | null>(null)
  const [summary, setSummary] = useState<IngestSummary | null>(null)
  const [error, setError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  // Cancel polling (not the server-side run) when the panel unmounts.
  useEffect(() => () => abortRef.current?.abort(), [])

  const drConfig = resolveDeepResearchConfig(apiKeys)

  if (!drConfig) {
    return (
      <Card className="text-center py-12">
        <KeyRound size={28} className="text-edge-2 mx-auto mb-4" aria-hidden />
        <h3 className="text-white font-medium mb-2">Deep Research needs a Google Gemini API key</h3>
        <p className="text-sm text-muted max-w-md mx-auto mb-6 leading-relaxed">
          In-app Deep Research runs on your Gemini key (independent of your reasoning provider).
          Add one in Settings — or run Deep Research free in the Gemini app and use the Paste tab.
        </p>
        <Link to="/settings">
          <Button variant="subtle">Configure in Settings</Button>
        </Link>
      </Card>
    )
  }

  const waitAndIngest = async (interactionId: string) => {
    const controller = new AbortController()
    abortRef.current = controller
    setPhase('researching')
    setError(null)
    setSummary(null)
    try {
      const report = await awaitDeepResearch(interactionId, drConfig, {
        signal: controller.signal,
        onProgress: setProgress,
      })
      setPendingInteraction(null)
      if (config) {
        setPhase('extracting')
        setSummary(await ingestReport(report, 'deep-research', config))
      } else {
        setError('Research finished, but no AI provider is configured to extract the jobs. Configure one in Settings, then Resume.')
        setPendingInteraction(interactionId)
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Deep Research failed.'
      setError(message)
      // A hard failure means nothing to resume; timeouts/aborts stay resumable.
      if (/run failed/i.test(message)) setPendingInteraction(null)
    } finally {
      setPhase('idle')
      setProgress(null)
      abortRef.current = null
    }
  }

  const start = async () => {
    setPhase('researching')
    setError(null)
    setSummary(null)
    try {
      const prompt = buildResearchPrompt({ prefs, resumeFacts: buildResumeFacts(resume) })
      const { interactionId } = await startDeepResearch(prompt, drConfig)
      setPendingInteraction(interactionId)
      await waitAndIngest(interactionId)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start Deep Research.')
      setPhase('idle')
    }
  }

  const busy = phase !== 'idle'
  const minutes = progress ? Math.floor(progress.elapsedMs / 60_000) : 0

  return (
    <Card>
      <p className="text-sm text-muted mb-1 leading-relaxed">
        An exhaustive research agent hunts across career pages, job boards, and aggregators, then
        the findings are extracted into the review queue.
      </p>
      <p className="text-xs text-amber-400/90 mb-4">{DEEP_RESEARCH_HINT}</p>

      <div className="flex items-center gap-3 flex-wrap">
        {!busy && !pendingInteractionId && (
          <Button onClick={start}>
            <FlaskConical size={14} aria-hidden /> Start Deep Research
          </Button>
        )}

        {!busy && pendingInteractionId && (
          <>
            <Button onClick={() => waitAndIngest(pendingInteractionId)}>
              <Loader2 size={14} aria-hidden /> Resume waiting
            </Button>
            <span className="text-xs text-faint">
              A previous run is still in flight on the server.
            </span>
          </>
        )}

        {busy && (
          <>
            <Button variant="ghost" onClick={() => abortRef.current?.abort()}>
              <Square size={14} aria-hidden /> Pause waiting
            </Button>
            <span className="text-sm text-muted inline-flex items-center gap-2">
              <Loader2 size={14} className="animate-spin" aria-hidden />
              {phase === 'extracting'
                ? 'Research done — extracting jobs…'
                : progress
                  ? `Researching… ${minutes} min elapsed (${progress.status})`
                  : 'Starting research…'}
            </span>
          </>
        )}

        {summary && (
          <span className="text-sm text-emerald-400">
            {summary.added === 0 && !hasSkips(summary) ? 'No jobs found.' : formatIngestSummary(summary)}
          </span>
        )}
      </div>

      {error && (
        <p className="text-sm text-red-400 mt-4" role="alert">
          {error}
        </p>
      )}
    </Card>
  )
}
