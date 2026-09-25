// discovery-worker: runs job discovery for one user (Bearer JWT) or a scheduled batch of due users
// (x-discovery-secret header). Reuses the app's domain code from src/ via the deno.json `@/` import map.

import { createAdminClient, createUserClient, type SupabaseClient } from '../_shared/admin.ts'
import { corsHeaders } from '../_shared/cors.ts'
import { runDiscovery, type DiscoveryStrategy, type JobSource } from '@/services/discovery/pipeline'
import { generateStrategiesWithAi } from '@/services/discovery/strategies'
import { enrichCandidate } from '@/services/discovery/enrich'
import { learnPreferences, applyLearnedToProfile, type DiscoverySignal } from '@/services/discovery/signals'
import { isDueForRun } from '@/services/discovery/cadence'
import { getAnalyzer } from '@/services/analysis/localHeuristicAnalyzer'
import { parseJobsJson, normalizeCandidates } from '@/services/ai/tasks/extractJobsCore'
import { createEmptyKnowledgeBase } from '@/constants/emptyKnowledgeBase'
import { projectKnowledgeBase } from '@/services/resume/projection'
import type { SearchProfile } from '@/types/searchProfile'
import type { MasterResume } from '@/types/resume'
import type { DiscoveredCandidate } from '@/types/discovery'
import type { PlanTier } from '@/constants/plan'

// Env-overridable so a model deprecation needs no code change.
const GEMINI_MODEL = Deno.env.get('GEMINI_MODEL') ?? 'gemini-3.5-flash'
const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta'
const MAX_CANDIDATES_PER_RUN = 30
const MAX_USERS_PER_TICK = 25
const ENRICH_TOP_K = 5

/** The fields read from a Gemini generateContent response; optional because the body is not trusted. */
interface GeminiResponse {
  candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>
  usageMetadata?: { totalTokenCount?: number }
}

async function geminiGenerate(
  apiKey: string,
  prompt: string,
  grounded: boolean,
): Promise<{ text: string; tokens: number }> {
  const res = await fetch(`${GEMINI_BASE}/models/${GEMINI_MODEL}:generateContent`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-goog-api-key': apiKey },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      tools: grounded ? [{ google_search: {} }] : undefined,
      generationConfig: { temperature: grounded ? 0.3 : 0, maxOutputTokens: 4000 },
    }),
  })
  const data: GeminiResponse = await res.json()
  if (!res.ok) throw new Error(`Gemini HTTP ${res.status}: ${JSON.stringify(data).slice(0, 200)}`)
  const parts = data?.candidates?.[0]?.content?.parts
  const text = (Array.isArray(parts) ? parts : []).map((p) => p?.text ?? '').join('')
  const tokens = Number(data?.usageMetadata?.totalTokenCount ?? 0)
  return { text, tokens }
}

function strategySearchPrompt(strategy: DiscoveryStrategy): string {
  return [
    'You are a job-search agent. Using live web search, find CURRENTLY OPEN job postings that match:',
    '',
    strategy.query,
    '',
    'Return a plain-text list of real, currently-open postings. For each: company, exact role title,',
    'location / work mode, salary if stated, the direct application URL (only if you actually found it),',
    'and a faithful summary of requirements/stack. Do NOT invent postings or URLs. Aim for 6–12 matches.',
  ].join('\n')
}

const EXTRACT_PROMPT_HEAD = [
  'You are a data-extraction engine. Extract every distinct job opening from the report into a JSON',
  'array. Output ONLY the JSON array. Each element: {"company","role","description","url"|null,',
  '"location"|null,"salaryRange"|null,"workMode":"remote"|"hybrid"|"onsite"|"unknown"}. Never invent',
  'data or URLs. If none, output [].',
  '',
  'REPORT:',
  '',
].join('\n')

/** Job source: grounded Gemini search, then a second call to extract JSON. Reports tokens via onTokens. */
function createServerGeminiSource(apiKey: string, onTokens: (n: number) => void): JobSource {
  return {
    id: 'grounded-gemini-server',
    async search(strategy) {
      const grounded = await geminiGenerate(apiKey, strategySearchPrompt(strategy), true)
      onTokens(grounded.tokens)
      const extracted = await geminiGenerate(apiKey, `${EXTRACT_PROMPT_HEAD}${grounded.text}`, false)
      onTokens(extracted.tokens)
      const { jobs } = normalizeCandidates(parseJobsJson(extracted.text))
      return jobs
    },
  }
}

/** Same monthly cap as ai-proxy: Free 100k, Pro 2M, overridable via *_TIER_MONTHLY_TOKEN_LIMIT; 0 = unlimited. */
function monthlyLimitFor(tier: PlanTier): number {
  const raw = tier === 'pro'
    ? Deno.env.get('PRO_TIER_MONTHLY_TOKEN_LIMIT')
    : Deno.env.get('FREE_TIER_MONTHLY_TOKEN_LIMIT')
  const fallback = tier === 'pro' ? 2_000_000 : 100_000
  return raw === undefined || raw === '' ? fallback : Number(raw)
}

async function tierOverBudget(admin: SupabaseClient, userId: string, tier: PlanTier): Promise<boolean> {
  const limit = monthlyLimitFor(tier)
  if (limit <= 0) return false
  const monthStart = new Date()
  monthStart.setUTCDate(1)
  monthStart.setUTCHours(0, 0, 0, 0)
  const { data: rows } = await admin
    .from('token_usage_logs')
    .select('total_tokens')
    .eq('user_id', userId)
    .gte('created_at', monthStart.toISOString())
  const used = (rows ?? []).reduce((s: number, r: { total_tokens?: number }) => s + (r.total_tokens ?? 0), 0)
  return used >= limit
}

async function runForUser(admin: SupabaseClient, apiKey: string, userId: string, trigger: string): Promise<void> {
  const { data: profileRow } = await admin
    .from('search_profiles')
    .select('data, scoring_snapshot')
    .eq('user_id', userId)
    .maybeSingle()
  const profile = (profileRow?.data ?? null) as SearchProfile | null
  if (!profile) return // nothing to search for yet

  const { data: sub } = await admin.from('subscriptions').select('tier').eq('user_id', userId).maybeSingle()
  const tier = (sub?.tier ?? 'free') as PlanTier
  if (await tierOverBudget(admin, userId, tier)) return

  const { data: runRow } = await admin
    .from('discovery_runs')
    .insert({ user_id: userId, trigger, status: 'running', started_at: new Date().toISOString() })
    .select('id')
    .single()
  const runId = (runRow?.id as string | undefined) ?? null

  let tokens = 0
  const onTokens = (n: number) => {
    tokens += n
  }

  try {
    // Score against the client-published snapshot, or an empty resume if none exists.
    const resume = (profileRow?.scoring_snapshot ?? projectKnowledgeBase(createEmptyKnowledgeBase())) as MasterResume

    // Dedupe context.
    const [{ data: jobRows }, { data: pendingRows }, { data: discoveryRow }] = await Promise.all([
      admin.from('jobs').select('data').eq('user_id', userId),
      admin.from('discovered_jobs').select('data').eq('user_id', userId).eq('status', 'pending'),
      admin.from('discoveries').select('state').eq('user_id', userId).maybeSingle(),
    ])
    const existingJobs = (jobRows ?? []).map((r: { data: { company: string; role: string; url?: string } }) => ({
      company: r.data.company, role: r.data.role, url: r.data.url,
    }))
    const existingCandidates = (pendingRows ?? []).map((r: { data: DiscoveredCandidate }) => r.data)
    const dismissedKeys = (discoveryRow?.state?.dismissedKeys ?? []) as string[]

    // Preferences learned from past reactions bias the profile before strategy generation.
    const { data: signalRows } = await admin
      .from('discovery_signals')
      .select('action, features')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(500)
    const prefs = learnPreferences((signalRows ?? []) as DiscoverySignal[])
    const learnedProfile = applyLearnedToProfile(profile, prefs)

    // Falls back to deterministic strategies if the AI call fails.
    const strategies = await generateStrategiesWithAi(learnedProfile, async (prompt) => {
      const r = await geminiGenerate(apiKey, prompt, false)
      onTokens(r.tokens)
      return r.text
    })

    const analyzer = getAnalyzer()
    const freshThisRun: DiscoveredCandidate[] = []
    const stats = await runDiscovery(
      { strategies, resume, dedupe: { existingJobs, existingCandidates, dismissedKeys }, maxCandidates: MAX_CANDIDATES_PER_RUN, runId: runId ?? undefined },
      {
        source: createServerGeminiSource(apiKey, onTokens),
        analyze: (job, r) => analyzer.analyze({ job, resume: r }),
        onCandidate: async (candidate) => {
          freshThisRun.push(candidate)
          await admin.from('discovered_jobs').insert({
            id: candidate.id, user_id: userId, url: candidate.url ?? null,
            status: 'pending', score: candidate.matchScore ?? null, data: candidate,
          })
        },
      },
    )

    // Enrich the top-K new candidates with an explanation and suggested action.
    const enrichComplete = async (system: string, user: string): Promise<string> => {
      const r = await geminiGenerate(apiKey, `${system}\n\n${user}`, false)
      onTokens(r.tokens)
      return r.text
    }
    const toEnrich = freshThisRun
      .filter((c) => c.analysis)
      .sort((a, b) => (b.matchScore ?? -1) - (a.matchScore ?? -1))
      .slice(0, ENRICH_TOP_K)
    for (const candidate of toEnrich) {
      const patch = await enrichCandidate(candidate, resume, enrichComplete)
      const patched = { ...candidate, ...patch }
      await admin
        .from('discovered_jobs')
        .update({ data: patched, score: patched.matchScore ?? null })
        .eq('id', patched.id)
    }

    // Record spend so the budget guard counts the worker's usage.
    if (tokens > 0) {
      await admin.from('token_usage_logs').insert({
        user_id: userId, provider: 'gemini', model: GEMINI_MODEL,
        prompt_tokens: 0, completion_tokens: 0, total_tokens: tokens,
      })
    }

    await admin.from('discovery_runs').update({
      status: stats.errors > 0 && stats.fresh === 0 ? 'failed' : stats.errors > 0 ? 'partial' : 'succeeded',
      stats, tokens_used: tokens, finished_at: new Date().toISOString(),
    }).eq('id', runId)
  } catch (err) {
    if (runId) {
      await admin.from('discovery_runs').update({
        status: 'failed', error: String(err), tokens_used: tokens, finished_at: new Date().toISOString(),
      }).eq('id', runId)
    }
  }
}

/** Users with a search profile whose last successful run is older than their plan's cadence. */
async function selectDueUsers(admin: SupabaseClient): Promise<string[]> {
  const { data: profiles } = await admin.from('search_profiles').select('user_id').limit(500)
  const due: string[] = []
  const nowMs = Date.now()
  for (const row of profiles ?? []) {
    if (due.length >= MAX_USERS_PER_TICK) break
    const userId = row.user_id as string
    const { data: sub } = await admin.from('subscriptions').select('tier').eq('user_id', userId).maybeSingle()
    const tier = (sub?.tier ?? 'free') as PlanTier
    const { data: lastRun } = await admin
      .from('discovery_runs')
      .select('finished_at')
      .eq('user_id', userId)
      .eq('status', 'succeeded')
      .order('finished_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (isDueForRun(lastRun?.finished_at ?? null, tier, nowMs)) due.push(userId)
  }
  return due
}

/** Constant-time comparison for the scheduler secret, so timing doesn't leak partial matches. */
function timingSafeEqual(a: string, b: string): boolean {
  const left = new TextEncoder().encode(a)
  const right = new TextEncoder().encode(b)
  if (left.length !== right.length) return false
  let diff = 0
  for (let i = 0; i < left.length; i++) diff |= left[i] ^ right[i]
  return diff === 0
}

Deno.serve(async (req: Request): Promise<Response> => {
  const cors = corsHeaders(req)
  const json = (body: unknown, status = 200): Response =>
    new Response(JSON.stringify(body), { status, headers: { ...cors, 'content-type': 'application/json' } })

  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'Method not allowed.' }, 405)

  const apiKey = Deno.env.get('GEMINI_API_KEY')
  if (!apiKey) return json({ error: 'Server is missing GEMINI_API_KEY.' }, 500)

  let admin
  try {
    admin = createAdminClient()
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : String(err) }, 500)
  }

  const cronSecret = Deno.env.get('DISCOVERY_CRON_SECRET')
  const providedSecret = req.headers.get('x-discovery-secret')
  const authHeader = req.headers.get('Authorization')

  let userIds: string[] = []
  let trigger: 'manual' | 'scheduled' = 'scheduled'

  if (cronSecret && providedSecret && timingSafeEqual(providedSecret, cronSecret)) {
    const body = (await req.json().catch(() => ({}))) as { userIds?: string[] }
    userIds = Array.isArray(body.userIds) && body.userIds.length > 0
      ? body.userIds.filter((id) => typeof id === 'string')
      : await selectDueUsers(admin)
    trigger = 'scheduled'
  } else if (authHeader) {
    let asUser
    try {
      asUser = createUserClient(authHeader)
    } catch (err) {
      return json({ error: err instanceof Error ? err.message : String(err) }, 500)
    }
    const { data: { user }, error } = await asUser.auth.getUser()
    if (error || !user) return json({ error: 'Invalid or expired session.' }, 401)
    userIds = [user.id]
    trigger = 'manual'
  } else {
    return json({ error: 'Missing authorization.' }, 401)
  }

  // Sequential to bound concurrent AI cost; runForUser isolates each user's failures.
  for (const userId of userIds) {
    await runForUser(admin, apiKey, userId, trigger)
  }

  return json({ ok: true, trigger, processed: userIds.length })
})
