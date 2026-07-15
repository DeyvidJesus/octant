import type { RequirementImportance, SeniorityLevel } from '@/types/analysis'
import { SKILL_TAXONOMY, type TaxonomyEntry } from '@/constants/skillTaxonomy'

export interface TaxonomyHit {
  entry: TaxonomyEntry
  /** The alias that actually appeared in the text (most frequent one). */
  term: string
  count: number
  /**
   * 'required' if mentioned in any must-have context, else 'preferred'.
   * A skill named in both contexts is treated as required (stronger signal).
   */
  importance: RequirementImportance
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

// Headings that flip the section mode for the lines that follow them.
const PREFERRED_HEADINGS = ['nice to have', 'nice-to-have', 'bonus', 'preferred', 'pluses', 'good to have', 'desirable', 'nice-to-haves']
const REQUIRED_HEADINGS = ['requirement', 'required', 'must have', 'must-have', "what you'll need", 'what you need', 'qualification', 'we require', 'minimum qualification', 'you have']
// Markers that make a single line optional regardless of the current section.
const INLINE_PREFERRED_MARKERS = ['a plus', 'is a plus', 'plus if', 'nice to have', 'ideally', 'would be great', 'good to have', 'desirable', 'not required', 'bonus points', 'a bonus']

interface Line {
  text: string
  mode: RequirementImportance
}

/**
 * Splits the JD into fine segments (on both line breaks and sentence
 * boundaries) and tags each with required/preferred based on the nearest
 * preceding heading, plus inline "a plus"-style markers. Splitting on
 * sentences too means a single-line description with "Requirements: … Nice to
 * have: …" is still classified section-by-section.
 */
function segmentLines(lower: string): Line[] {
  const raw = lower.split(/\n|(?<=[.;])\s+/)
  const lines: Line[] = []
  let mode: RequirementImportance = 'required'

  for (const chunk of raw) {
    const line = chunk.trim()
    if (!line) continue
    if (PREFERRED_HEADINGS.some((h) => line.includes(h))) {
      mode = 'preferred'
    } else if (REQUIRED_HEADINGS.some((h) => line.includes(h))) {
      mode = 'required'
    }
    const lineMode: RequirementImportance = INLINE_PREFERRED_MARKERS.some((m) => line.includes(m))
      ? 'preferred'
      : mode
    lines.push({ text: line, mode: lineMode })
  }

  return lines
}

/** Finds every taxonomy skill mentioned in the text, with frequencies and importance. */
export function extractSkills(text: string): TaxonomyHit[] {
  const lines = segmentLines(text.toLowerCase())

  const accumulator = new Map<
    TaxonomyEntry,
    { total: number; requiredCount: number; bestAlias: string; bestCount: number }
  >()

  for (const line of lines) {
    for (const entry of SKILL_TAXONOMY) {
      for (const alias of entry.aliases) {
        const count = countOccurrences(line.text, alias)
        if (count === 0) continue
        const rec = accumulator.get(entry) ?? { total: 0, requiredCount: 0, bestAlias: '', bestCount: 0 }
        rec.total += count
        if (line.mode === 'required') rec.requiredCount += count
        if (count > rec.bestCount) {
          rec.bestCount = count
          rec.bestAlias = alias
        }
        accumulator.set(entry, rec)
      }
    }
  }

  const hits: TaxonomyHit[] = []
  for (const [entry, rec] of accumulator) {
    hits.push({
      entry,
      term: rec.bestAlias,
      count: rec.total,
      importance: rec.requiredCount > 0 ? 'required' : 'preferred',
    })
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
