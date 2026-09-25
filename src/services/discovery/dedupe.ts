import type { JobOpportunity } from '@/types/job'
import type { DiscoveredCandidate } from '@/types/discovery'

// Deterministic duplicate detection; repeated research runs would otherwise refill the queue with the same jobs.

/** Trailing legal-form tokens that don't identify a company. */
const COMPANY_SUFFIXES = new Set(['inc', 'incorporated', 'llc', 'ltd', 'ltda', 'gmbh', 'sa', 'corp', 'co'])

function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^\p{L}\p{N} ]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function stripCompanySuffix(normalized: string): string {
  const words = normalized.split(' ')
  while (words.length > 1 && COMPANY_SUFFIXES.has(words[words.length - 1])) {
    words.pop()
  }
  return words.join(' ')
}

/** 'Acme, Inc.' + 'Sr. Frontend Engineer (Remote)' → 'acme::sr frontend engineer remote' */
export function candidateKey(company: string, role: string): string {
  return `${stripCompanySuffix(normalizeText(company))}::${normalizeText(role)}`
}

/** Host + path only: job boards identify postings by path, and query/hash are tracking noise. */
export function normalizeUrl(url: string | undefined): string | undefined {
  if (!url) return undefined
  try {
    const parsed = new URL(url)
    const path = parsed.pathname.replace(/\/+$/, '')
    return `${parsed.hostname.toLowerCase()}${path}`
  } catch {
    return undefined
  }
}

export interface DedupeContext {
  existingJobs: Array<Pick<JobOpportunity, 'company' | 'role' | 'url'>>
  existingCandidates: DiscoveredCandidate[]
  dismissedKeys: string[]
}

export interface DedupeResult {
  fresh: DiscoveredCandidate[]
  skipped: {
    asDuplicateOfBoard: number
    asDuplicateOfQueue: number
    asDismissed: number
    withinBatch: number
  }
}

/** Drops items whose company+role key or URL matches the board, queue, dismissed keys, or earlier batch items. */
export function dedupeCandidates(batch: DiscoveredCandidate[], ctx: DedupeContext): DedupeResult {
  const boardKeys = new Set(ctx.existingJobs.map((job) => candidateKey(job.company, job.role)))
  const boardUrls = new Set(ctx.existingJobs.map((job) => normalizeUrl(job.url)).filter(Boolean))
  const queueKeys = new Set(ctx.existingCandidates.map((c) => candidateKey(c.company, c.role)))
  const queueUrls = new Set(ctx.existingCandidates.map((c) => normalizeUrl(c.url)).filter(Boolean))
  const dismissed = new Set(ctx.dismissedKeys)

  const seenKeys = new Set<string>()
  const seenUrls = new Set<string>()

  const fresh: DiscoveredCandidate[] = []
  const skipped = { asDuplicateOfBoard: 0, asDuplicateOfQueue: 0, asDismissed: 0, withinBatch: 0 }

  for (const candidate of batch) {
    const key = candidateKey(candidate.company, candidate.role)
    const url = normalizeUrl(candidate.url)

    if (seenKeys.has(key) || (url && seenUrls.has(url))) {
      skipped.withinBatch += 1
    } else if (boardKeys.has(key) || (url && boardUrls.has(url))) {
      skipped.asDuplicateOfBoard += 1
    } else if (queueKeys.has(key) || (url && queueUrls.has(url))) {
      skipped.asDuplicateOfQueue += 1
    } else if (dismissed.has(key)) {
      skipped.asDismissed += 1
    } else {
      fresh.push(candidate)
    }

    seenKeys.add(key)
    if (url) seenUrls.add(url)
  }

  return { fresh, skipped }
}
