import type { CareerFact, FactType, UnclassifiedFact } from '@/types/resume'
import { createId } from '@/utils/id'

/**
 * Promotes a raw, unclassified note into a typed CareerFact. The promoted fact
 * lands as `needs_review` (not silently confirmed) so it still passes through a
 * human check before it can flow into the resume projection.
 */
export function classifyFact(unclassified: UnclassifiedFact, type: FactType): CareerFact {
  return {
    id: createId(),
    type,
    statement: unclassified.rawText,
    status: 'needs_review',
    roleIds: [],
    initiativeIds: [],
    skillIds: [],
    metricIds: [],
    tags: [],
    provenance: {
      source: unclassified.source,
      excerpt: unclassified.rawText,
      notes: `Classified from triage inbox (${unclassified.reason})`,
    },
  }
}

/** A blank manual fact for the "add fact" action. */
export function emptyFact(): CareerFact {
  return {
    id: createId(),
    type: 'achievement',
    statement: '',
    status: 'todo',
    roleIds: [],
    initiativeIds: [],
    skillIds: [],
    metricIds: [],
    tags: [],
    provenance: { source: 'manual', excerpt: '' },
  }
}
