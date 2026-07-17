import type {
  CareerFact,
  CareerKnowledgeBase,
  KnowledgeLearningEntry,
  Metric,
  TechnicalDecision,
  UnclassifiedFact,
} from '@/types/resume'

/**
 * In-memory search over knowledge-base entities. At single-user scale a
 * client-side scan is correct; a Dexie token index only becomes necessary at
 * the "thousands of documents" scale the design review defers (roadmap follow-up).
 */

/** True when every whitespace-separated token in `query` appears in `text`. */
export function matchesQuery(text: string, query: string): boolean {
  const trimmed = query.trim().toLocaleLowerCase()
  if (!trimmed) return true
  const haystack = text.toLocaleLowerCase()
  return trimmed.split(/\s+/).every((token) => haystack.includes(token))
}

export function filterByQuery<T>(items: T[], query: string, toText: (item: T) => string): T[] {
  if (!query.trim()) return items
  return items.filter((item) => matchesQuery(toText(item), query))
}

export function factText(fact: CareerFact): string {
  return [fact.statement, fact.type, fact.status, ...fact.tags].join(' ')
}

export function decisionText(decision: TechnicalDecision): string {
  return [
    decision.context,
    decision.selectedApproach,
    decision.rationale ?? '',
    decision.outcome ?? '',
    ...decision.optionsConsidered,
    ...decision.tradeoffs,
  ].join(' ')
}

export function metricText(metric: Metric): string {
  return [metric.statement, metric.kind, metric.unit ?? '', metric.baseline ?? ''].join(' ')
}

export function learningText(entry: KnowledgeLearningEntry): string {
  return [entry.title, entry.provider, entry.notes ?? ''].join(' ')
}

export function unclassifiedText(item: UnclassifiedFact): string {
  return [item.rawText, item.source, item.reason].join(' ')
}

export interface KnowledgeStats {
  facts: number
  needsReview: number
  decisions: number
  metrics: number
  learning: number
  inbox: number
}

/** Headline counts across the knowledge base for the page's summary strip. */
export function knowledgeStats(kb: CareerKnowledgeBase): KnowledgeStats {
  return {
    facts: kb.facts.length,
    needsReview: kb.facts.filter((fact) => fact.status !== 'confirmed').length,
    decisions: kb.technicalDecisions.length,
    metrics: kb.metrics.length,
    learning: kb.learning.length,
    inbox: kb.unclassifiedFacts.length,
  }
}
