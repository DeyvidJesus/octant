import type { AiRunConfig } from '@/services/ai/types'
import { getProvider } from '@/services/ai/providers'
import { extractJobs, type ExtractedJob } from '@/services/ai/tasks/extractJobs'
import type { DiscoveryStrategy, JobSource } from '../pipeline'

/**
 * Continuous-collection source: a Google-search-grounded Gemini completion per strategy, followed by
 * the shared deterministic extraction seam. Runs through `ai-proxy` (server-side Gemini key). This is
 * the "predictable/efficient" collection path — Deep Research is reserved for analysis/strategy.
 */

/** Current Gemini model used for discovery (search + strategy). One place to bump on deprecations. */
export const GEMINI_DISCOVERY_MODEL = 'gemini-2.5-flash'

/** Gemini is the only web-search-grounding provider; the operator's key is injected by ai-proxy. */
const SEARCH_CONFIG: AiRunConfig = { providerId: 'gemini', model: GEMINI_DISCOVERY_MODEL }

function buildStrategyPrompt(strategy: DiscoveryStrategy): string {
  return [
    'You are a job-search agent. Using live web search, find CURRENTLY OPEN job postings that match:',
    '',
    strategy.query,
    '',
    'Return a plain-text list of real, currently-open postings. For each include: company, exact role',
    'title, location / work mode, salary if stated, the direct application URL (only if you actually',
    'found it), and a faithful summary of the requirements and stack. Do NOT invent postings or URLs.',
    'Prefer roles posted in the last few weeks. Aim for 6–12 strong matches.',
  ].join('\n')
}

/** Builds the client-side grounded source. */
export function createGroundedGeminiSource(): JobSource {
  return {
    id: 'grounded-gemini',
    async search(strategy: DiscoveryStrategy, signal?: AbortSignal): Promise<ExtractedJob[]> {
      const grounded = await getProvider(SEARCH_CONFIG.providerId).complete({
        model: SEARCH_CONFIG.model,
        messages: [{ role: 'user', content: buildStrategyPrompt(strategy) }],
        temperature: 0.3,
        maxTokens: 3000,
        webSearch: true,
        signal,
      })
      const extraction = await extractJobs(grounded.text, SEARCH_CONFIG, signal)
      return extraction.jobs
    },
  }
}
