import type { DiscoveredCandidate } from '@/types/discovery'

/**
 * Phase 5 (Career agent) — the proactive surface. These pure helpers let the app show "the agent
 * worked for you while you were away" (unseen counts, a digest) instead of making the user run a
 * search. `lastSeenAt` is the timestamp the user last opened the feed.
 */

/** How many pending candidates arrived since the user last looked at the feed. */
export function countUnseen(candidates: Pick<DiscoveredCandidate, 'foundAt'>[], lastSeenAt: string | null): number {
  if (!lastSeenAt) return candidates.length
  return candidates.filter((c) => (c.foundAt ?? '') > lastSeenAt).length
}

/** A one-line proactive digest for the agent header (deterministic — no AI). */
export function buildDigest(candidates: DiscoveredCandidate[], lastSeenAt: string | null): string | null {
  const unseen = countUnseen(candidates, lastSeenAt)
  if (unseen === 0) return null
  const top = [...candidates]
    .filter((c) => !lastSeenAt || (c.foundAt ?? '') > lastSeenAt)
    .sort((a, b) => (b.matchScore ?? -1) - (a.matchScore ?? -1))[0]
  const noun = unseen === 1 ? 'new opportunity' : 'new opportunities'
  if (top && top.matchScore !== undefined) {
    return `${unseen} ${noun} since you last looked — top: ${top.role} at ${top.company} (${top.matchScore}%).`
  }
  return `${unseen} ${noun} since you last looked.`
}
