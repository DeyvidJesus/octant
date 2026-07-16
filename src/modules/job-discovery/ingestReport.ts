import type { CandidateOrigin } from '@/types/discovery'
import type { AiRunConfig } from '@/services/ai/types'
import { extractJobs, toCandidates, type ExtractJobsResult } from '@/services/ai/tasks/extractJobs'
import { dedupeCandidates, type DedupeResult } from '@/services/discovery/dedupe'
import { scoreCandidates } from '@/services/discovery/scoreCandidates'
import { useJobsStore } from '@/stores/jobsStore'
import { useDiscoveryStore } from '@/stores/discoveryStore'
import { useResumeStore } from '@/stores/resumeStore'

export interface IngestSummary {
  added: number
  skipped: DedupeResult['skipped']
  warnings: string[]
}

/**
 * The shared tail of every discovery source: wrap extracted jobs with
 * provenance → dedupe against board/queue/dismissed → score locally →
 * queue for review. Nothing here touches the board.
 */
export async function ingestExtraction(
  extraction: ExtractJobsResult,
  origin: CandidateOrigin,
): Promise<IngestSummary> {
  const batch = toCandidates(extraction.jobs, origin, `${extraction.providerId} · ${extraction.model}`)

  const discovery = useDiscoveryStore.getState()
  const { fresh, skipped } = dedupeCandidates(batch, {
    existingJobs: useJobsStore.getState().jobs,
    existingCandidates: discovery.candidates,
    dismissedKeys: discovery.dismissedKeys,
  })

  const scored = await scoreCandidates(fresh, useResumeStore.getState().resume)
  discovery.addCandidates(scored)
  if (origin !== 'paste') discovery.markSweepRan()

  return { added: scored.length, skipped, warnings: extraction.warnings }
}

/** Full ingest for raw report text (the paste and Deep Research paths). */
export async function ingestReport(
  reportText: string,
  origin: CandidateOrigin,
  config: AiRunConfig,
  signal?: AbortSignal,
): Promise<IngestSummary> {
  const extraction = await extractJobs(reportText, config, signal)
  return ingestExtraction(extraction, origin)
}

export function formatIngestSummary({ added, skipped }: IngestSummary): string {
  const parts = [`${added} added to the review queue`]
  const duplicates = skipped.asDuplicateOfBoard + skipped.asDuplicateOfQueue + skipped.withinBatch
  if (duplicates > 0) parts.push(`${duplicates} duplicate${duplicates === 1 ? '' : 's'} skipped`)
  if (skipped.asDismissed > 0) parts.push(`${skipped.asDismissed} previously dismissed`)
  return parts.join(' · ')
}

export function hasSkips({ skipped }: IngestSummary): boolean {
  const { asDuplicateOfBoard, asDuplicateOfQueue, asDismissed, withinBatch } = skipped
  return asDuplicateOfBoard + asDuplicateOfQueue + asDismissed + withinBatch > 0
}
