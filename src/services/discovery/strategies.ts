import type { SearchProfile } from '@/types/searchProfile'
import { generateStrategies, type DiscoveryStrategy } from './pipeline'

// AI-generated diverse search queries, one small call per run. Transport is injected so this runs
// in the browser and the Deno worker; any failure falls back to `generateStrategies`.

/** Injected completion: takes a prompt, returns raw text. */
export type CompleteFn = (prompt: string, opts?: { temperature?: number; maxTokens?: number }) => Promise<string>

const MAX_STRATEGIES = 6

const SYSTEM_PROMPT = [
  'You are a job-search strategist. Given a candidate\'s structured search profile, produce a set of',
  'DIVERSE search strategies — different angles that together maximise coverage of relevant, currently',
  'open roles (vary the role framing, seniority, stack emphasis, industry/niche, and location).',
  'Output ONLY a JSON array — no prose, no markdown, no code fences. Each element:',
  '{',
  '  "label": string,      // short human label, e.g. "Senior React — product SaaS"',
  '  "query": string,      // a concrete web-search query for currently-open postings',
  '  "rationale": string   // one line: why this angle fits the profile',
  '}',
  `Return between 3 and ${MAX_STRATEGIES} strategies. Respect exclusions and preferences in the profile.`,
].join('\n')

/** Serialises the profile into a compact brief for the model. */
export function buildStrategyGenPrompt(profile: SearchProfile): string {
  const lines = [
    profile.targetRoles.length ? `Target roles: ${profile.targetRoles.join(', ')}` : '',
    profile.seniority !== 'unknown' ? `Seniority: ${profile.seniority}` : '',
    profile.technologies.length ? `Technologies: ${profile.technologies.join(', ')}` : '',
    profile.locations.length ? `Locations: ${profile.locations.join(', ')}` : '',
    profile.workModes.length ? `Work modes: ${profile.workModes.join(', ')}` : '',
    profile.languages.length ? `Languages: ${profile.languages.join(', ')}` : '',
    profile.salaryFloor ? `Minimum salary: ${profile.salaryFloor} ${profile.salaryCurrency ?? ''}`.trim() : '',
    profile.includeKeywords.length ? `Must include: ${profile.includeKeywords.join(', ')}` : '',
    profile.excludeKeywords.length ? `Exclude: ${profile.excludeKeywords.join(', ')}` : '',
    profile.extraInstructions ? `Notes: ${profile.extraInstructions}` : '',
  ].filter(Boolean)
  return `CANDIDATE SEARCH PROFILE:\n${lines.join('\n')}`
}

/** Deterministic parse of the model's JSON array into validated strategies. */
export function parseStrategies(text: string): DiscoveryStrategy[] {
  const start = text.indexOf('[')
  const end = text.lastIndexOf(']')
  if (start === -1 || end === -1 || end < start) throw new Error('No JSON array found.')
  const parsed: unknown = JSON.parse(text.slice(start, end + 1))
  if (!Array.isArray(parsed)) throw new Error('Model output is not a JSON array.')

  const strategies: DiscoveryStrategy[] = []
  for (const item of parsed) {
    if (strategies.length >= MAX_STRATEGIES) break
    if (typeof item !== 'object' || item === null) continue
    const record = item as Record<string, unknown>
    const query = typeof record.query === 'string' ? record.query.trim() : ''
    if (!query) continue
    const label = typeof record.label === 'string' && record.label.trim() ? record.label.trim() : query.slice(0, 48)
    strategies.push({
      id: `strategy-ai-${strategies.length}`,
      label,
      query,
      rationale: typeof record.rationale === 'string' ? record.rationale.trim() : undefined,
    })
  }
  return strategies
}

/** Falls back to the deterministic builder on any error or empty result. */
export async function generateStrategiesWithAi(
  profile: SearchProfile,
  complete: CompleteFn,
): Promise<DiscoveryStrategy[]> {
  try {
    const text = await complete(`${SYSTEM_PROMPT}\n\n${buildStrategyGenPrompt(profile)}`, {
      temperature: 0.5,
      maxTokens: 1200,
    })
    const strategies = parseStrategies(text)
    return strategies.length > 0 ? strategies : generateStrategies(profile)
  } catch {
    return generateStrategies(profile)
  }
}
