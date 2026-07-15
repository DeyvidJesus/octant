import type { SeniorityLevel } from '@/types/analysis'
import { SKILL_TAXONOMY, type TaxonomyEntry } from '@/constants/skillTaxonomy'

export interface TaxonomyHit {
  entry: TaxonomyEntry
  /** The alias that actually appeared in the text (most frequent one). */
  term: string
  count: number
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Matches an alias on "term boundaries": not preceded/followed by a
 * word-ish character. Plain \b fails for aliases like "c#", ".net", "ci/cd".
 */
function countOccurrences(text: string, alias: string): number {
  const pattern = new RegExp(`(?<![a-z0-9#+.])${escapeRegex(alias)}(?![a-z0-9#+])`, 'g')
  return (text.match(pattern) ?? []).length
}

/** Finds every taxonomy skill mentioned in the text, with frequencies. */
export function extractSkills(text: string): TaxonomyHit[] {
  const lower = text.toLowerCase()
  const hits: TaxonomyHit[] = []

  for (const entry of SKILL_TAXONOMY) {
    let total = 0
    let bestAlias = ''
    let bestCount = 0
    for (const alias of entry.aliases) {
      const count = countOccurrences(lower, alias)
      total += count
      if (count > bestCount) {
        bestCount = count
        bestAlias = alias
      }
    }
    if (total > 0) {
      hits.push({ entry, term: bestAlias, count: total })
    }
  }

  return hits.sort((a, b) => b.count - a.count)
}

interface SeniorityResult {
  level: SeniorityLevel
  evidence: string[]
}

/** Ordered strongest-first; the first token match decides the level. */
const SENIORITY_TOKENS: Array<{ level: SeniorityLevel; pattern: RegExp }> = [
  { level: 'staff', pattern: /\b(staff|principal)\b/gi },
  { level: 'lead', pattern: /\b(tech lead|team lead|lead engineer|engineering lead)\b/gi },
  { level: 'senior', pattern: /\b(senior|sr\.?)\b/gi },
  { level: 'junior', pattern: /\b(junior|jr\.?|entry[- ]level|intern(ship)?)\b/gi },
  { level: 'mid', pattern: /\b(mid[- ]level|intermediate)\b/gi },
]

const YEARS_PATTERN = /(\d+)\s*(?:\+|-\d+)?\s*\+?\s*years?/gi

export function detectSeniority(text: string): SeniorityResult {
  const evidence: string[] = []
  let tokenLevel: SeniorityLevel | null = null

  for (const { level, pattern } of SENIORITY_TOKENS) {
    const matches = text.match(pattern)
    if (matches) {
      evidence.push(...new Set(matches.map((m) => `"${m.trim()}"`)))
      tokenLevel ??= level
    }
  }

  let yearsLevel: SeniorityLevel | null = null
  for (const match of text.matchAll(YEARS_PATTERN)) {
    evidence.push(`"${match[0].trim()}"`)
    const years = Number(match[1])
    const inferred: SeniorityLevel = years >= 5 ? 'senior' : years >= 3 ? 'mid' : 'junior'
    // Keep the highest years-based signal found.
    if (yearsLevel === null || rank(inferred) > rank(yearsLevel)) {
      yearsLevel = inferred
    }
  }

  return {
    level: tokenLevel ?? yearsLevel ?? 'unknown',
    evidence,
  }
}

function rank(level: SeniorityLevel): number {
  const order: SeniorityLevel[] = ['unknown', 'junior', 'mid', 'senior', 'lead', 'staff']
  return order.indexOf(level)
}
