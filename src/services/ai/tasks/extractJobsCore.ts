import type { WorkMode } from '@/types/job'
import type { CandidateOrigin, DiscoveredCandidate } from '@/types/discovery'
import { createId } from '@/utils/id'
import { nowIso } from '@/utils/dates'

/**
 * Pure extraction core — the deterministic half of the job-extraction seam, with NO provider/network
 * imports. Split out of `extractJobs.ts` so it can be shared by the browser AND the Deno discovery
 * worker (which imports it via the deno.json import map) without dragging in the Supabase client.
 */

/** Deep Research reports can be very long; cap what we send to the model. */
export const MAX_INPUT_CHARS = 60_000
/** A pathological model response can't flood the queue. */
export const MAX_CANDIDATES = 50
export const MAX_DESCRIPTION_CHARS = 8_000

export interface ExtractedJob {
  company: string
  role: string
  description: string
  url?: string
  location?: string
  salaryRange?: string
  workMode: WorkMode
}

export const EXTRACT_SYSTEM_PROMPT = [
  'You are a data-extraction engine. You will receive a report about job openings.',
  'Extract every distinct job opening into a JSON array. Output ONLY the JSON array — no prose, no markdown, no code fences.',
  '',
  'Each element:',
  '{',
  '  "company": string,            // employer name, required',
  '  "role": string,               // job title, required',
  '  "description": string,        // everything the report says about this job: requirements, stack,',
  '                                // responsibilities. Quote or faithfully condense the report.',
  '                                // NEVER add information the report does not contain.',
  '  "url": string | null,         // direct posting/application link ONLY if present verbatim in the report.',
  '                                // Never construct or guess a URL.',
  '  "location": string | null,',
  '  "salaryRange": string | null, // only if the report states it',
  '  "workMode": "remote" | "hybrid" | "onsite" | "unknown"',
  '}',
  '',
  'If the report contains no job openings, output [].',
].join('\n')

/** Exported for testing. */
export function buildExtractPrompt(reportText: string): string {
  return `REPORT:\n\n${reportText}`
}

/**
 * Deterministic parse of the model's reply: tolerate a fenced or prose-wrapped
 * array, but nothing looser than that. Throws when no JSON array is found.
 */
export function parseJobsJson(text: string): unknown {
  const start = text.indexOf('[')
  const end = text.lastIndexOf(']')
  if (start === -1 || end === -1 || end < start) {
    throw new Error('No JSON array found in the model output.')
  }
  const parsed: unknown = JSON.parse(text.slice(start, end + 1))
  if (!Array.isArray(parsed)) {
    throw new Error('Model output is not a JSON array.')
  }
  return parsed
}

/** Exported for testing: enum match first, then substring coercion, else 'unknown'. */
export function coerceWorkMode(value: unknown): WorkMode {
  if (typeof value !== 'string') return 'unknown'
  const lower = value.toLowerCase().trim()
  if (lower === 'remote' || lower === 'hybrid' || lower === 'onsite' || lower === 'unknown') return lower
  if (lower.includes('remote')) return 'remote'
  if (lower.includes('hybrid')) return 'hybrid'
  if (lower.includes('onsite') || lower.includes('on-site') || lower.includes('office')) return 'onsite'
  return 'unknown'
}

function cleanOptional(value: unknown): string | undefined {
  return typeof value === 'string' ? value.trim() || undefined : undefined
}

function cleanUrl(value: unknown): string | undefined {
  if (typeof value !== 'string' || !value.trim()) return undefined
  try {
    const parsed = new URL(value.trim())
    return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? value.trim() : undefined
  } catch {
    return undefined
  }
}

/**
 * Hand-rolled validation of the parsed array: entries without a company AND role
 * are dropped with a warning — code decides what survives, not the model.
 */
export function normalizeCandidates(raw: unknown): { jobs: ExtractedJob[]; warnings: string[] } {
  const warnings: string[] = []
  if (!Array.isArray(raw)) return { jobs: [], warnings: ['Model output was not an array.'] }

  const jobs: ExtractedJob[] = []
  let dropped = 0

  for (const item of raw) {
    if (jobs.length >= MAX_CANDIDATES) {
      warnings.push(`Capped at ${MAX_CANDIDATES} jobs — the report contained more.`)
      break
    }
    if (typeof item !== 'object' || item === null) {
      dropped += 1
      continue
    }
    const record = item as Record<string, unknown>
    const company = typeof record.company === 'string' ? record.company.trim() : ''
    const role = typeof record.role === 'string' ? record.role.trim() : ''
    if (!company || !role) {
      dropped += 1
      continue
    }

    const description = typeof record.description === 'string' ? record.description.trim() : ''
    jobs.push({
      company,
      role,
      description: description.slice(0, MAX_DESCRIPTION_CHARS),
      url: cleanUrl(record.url),
      location: cleanOptional(record.location),
      salaryRange: cleanOptional(record.salaryRange),
      workMode: coerceWorkMode(record.workMode),
    })
  }

  if (dropped > 0) {
    warnings.push(`${dropped} entr${dropped === 1 ? 'y' : 'ies'} dropped: missing company or role.`)
  }
  return { jobs, warnings }
}

/** Wraps extracted jobs into full queue candidates with provenance. */
export function toCandidates(
  jobs: ExtractedJob[],
  origin: CandidateOrigin,
  sourceNote: string,
): DiscoveredCandidate[] {
  return jobs.map((job) => ({
    ...job,
    id: createId(),
    origin,
    sourceNote,
    foundAt: nowIso(),
  }))
}
