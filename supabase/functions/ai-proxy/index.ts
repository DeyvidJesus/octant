// Supabase Edge Function: ai-proxy
//
// Phase 6 — Securing AI Execution. Hosted-vendor completions used to run straight from the browser,
// which shipped API keys to the client and hit vendor CORS. This function is the server-side seam:
// it verifies the caller's Supabase JWT, injects vendor API keys held ONLY in the Edge environment,
// makes the vendor call, and returns a normalized `{ text, model }` result. Keys never touch the
// client, and the browser talks to a same-trusted origin so CORS is a non-issue.
//
// Deploy:  supabase functions deploy ai-proxy
// Secrets: supabase secrets set OPENAI_API_KEY=... ANTHROPIC_API_KEY=... OPENROUTER_API_KEY=... GEMINI_API_KEY=...
// (SUPABASE_URL and SUPABASE_ANON_KEY are injected automatically.)

import { createClient } from 'jsr:@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

type ProviderId = 'openai' | 'openrouter' | 'claude' | 'gemini'
type Wire = 'openai' | 'anthropic' | 'gemini'

interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

interface ProxyRequest {
  providerId: ProviderId
  model: string
  messages: ChatMessage[]
  temperature?: number
  maxTokens?: number
  webSearch?: boolean
}

interface VendorConfig {
  url: string
  keyEnv: string
  wire: Wire
  extraHeaders?: Record<string, string>
}

const ANTHROPIC_VERSION = '2023-06-01'

// The vendor allowlist. Endpoints are fixed here (never taken from the client) to avoid SSRF.
const VENDORS: Record<ProviderId, VendorConfig> = {
  openai: {
    url: 'https://api.openai.com/v1/chat/completions',
    keyEnv: 'OPENAI_API_KEY',
    wire: 'openai',
  },
  openrouter: {
    url: 'https://openrouter.ai/api/v1/chat/completions',
    keyEnv: 'OPENROUTER_API_KEY',
    wire: 'openai',
    extraHeaders: { 'HTTP-Referer': 'https://career-os.local', 'X-Title': 'CareerOS' },
  },
  claude: {
    url: 'https://api.anthropic.com/v1/messages',
    keyEnv: 'ANTHROPIC_API_KEY',
    wire: 'anthropic',
  },
  // Gemini's endpoint embeds the model + method; `url` is the fixed base and the target is built in
  // buildVendorCall. Unlike the OpenAI/Anthropic wires, Gemini can ground on live Google Search.
  gemini: {
    url: 'https://generativelanguage.googleapis.com/v1beta',
    keyEnv: 'GEMINI_API_KEY',
    wire: 'gemini',
  },
}

Deno.serve(async (req: Request): Promise<Response> => {
  const cors = corsHeaders(req)
  const json = (body: unknown, status = 200): Response =>
    new Response(JSON.stringify(body), { status, headers: { ...cors, 'content-type': 'application/json' } })

  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'Method not allowed.' }, 405)

  // 1. Verify the caller's Supabase JWT by resolving the user it belongs to.
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return json({ error: 'Missing authorization header.' }, 401)

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    { global: { headers: { Authorization: authHeader } }, auth: { persistSession: false } },
  )
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return json({ error: 'Invalid or expired session.' }, 401)

  // 2. Parse + validate the request.
  let payload: ProxyRequest
  try {
    payload = await req.json()
  } catch {
    return json({ error: 'Invalid JSON body.' }, 400)
  }

  const vendor = VENDORS[payload?.providerId]
  if (!vendor) return json({ error: `Unsupported provider: ${payload?.providerId}` }, 400)
  if (!Array.isArray(payload.messages) || typeof payload.model !== 'string') {
    return json({ error: 'Request must include messages[] and a model.' }, 400)
  }
  if (payload.webSearch && vendor.wire !== 'gemini') {
    // Matches the frontend guard: only Gemini can ground on live Google Search here.
    return json({ error: `${payload.providerId} does not support web search grounding.` }, 400)
  }

  const apiKey = Deno.env.get(vendor.keyEnv)
  if (!apiKey) return json({ error: `Server is missing ${vendor.keyEnv}.` }, 500)

  // Service-role client for budget checks + usage logging. Bypasses RLS; never exposed to clients.
  const admin = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    { auth: { persistSession: false } },
  )

  // Tier-aware monthly token cap protecting the operator's vendor cost. Defaults: Free 100k, Pro 2M.
  // Tune with FREE_TIER_MONTHLY_TOKEN_LIMIT / PRO_TIER_MONTHLY_TOKEN_LIMIT; set a tier's value to 0
  // to make it unlimited.
  if (await tierOverBudget(admin, user.id)) {
    return json({ error: 'Monthly AI usage limit reached for your plan.' }, 429)
  }

  // 3. Build and make the vendor call.
  const { url, headers, body } = buildVendorCall(vendor, apiKey, payload)
  let vendorResponse: Response
  try {
    vendorResponse = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) })
  } catch (err) {
    return json({ error: `Could not reach ${payload.providerId}.`, detail: String(err) }, 502)
  }

  if (!vendorResponse.ok) {
    const detail = await safeDetail(vendorResponse)
    return json(
      { error: `${payload.providerId} request failed (HTTP ${vendorResponse.status}). ${detail}`.trim() },
      vendorResponse.status,
    )
  }

  // 4. Normalize the vendor response to { text, model }.
  const data = await vendorResponse.json()
  const text =
    vendor.wire === 'anthropic'
      ? parseAnthropic(data)
      : vendor.wire === 'gemini'
        ? parseGemini(data)
        : parseOpenAi(data)
  if (typeof text !== 'string' || text.length === 0) {
    return json({ error: `${payload.providerId}: unexpected response shape (no text content).` }, 502)
  }
  const model = typeof data?.model === 'string' ? data.model : payload.model

  // Log token usage for budget monitoring. Best-effort — monitoring must never fail the request.
  const usage = extractUsage(data, vendor.wire)
  try {
    await admin.from('token_usage_logs').insert({
      user_id: user.id,
      provider: payload.providerId,
      model,
      prompt_tokens: usage.prompt,
      completion_tokens: usage.completion,
      total_tokens: usage.total,
    })
  } catch {
    // Best-effort usage logging must never fail the request.
  }

  return json({ text, model })
})

interface TokenUsage {
  prompt: number
  completion: number
  total: number
}

/** Normalizes the vendor's usage block. OpenAI reports prompt/completion/total; Anthropic input/output. */
// deno-lint-ignore no-explicit-any
function extractUsage(data: any, wire: Wire): TokenUsage {
  if (wire === 'gemini') {
    const m = data?.usageMetadata ?? {}
    const prompt = Number(m.promptTokenCount ?? 0)
    const completion = Number(m.candidatesTokenCount ?? 0)
    return { prompt, completion, total: Number(m.totalTokenCount ?? prompt + completion) }
  }
  const u = data?.usage ?? {}
  if (wire === 'anthropic') {
    const prompt = Number(u.input_tokens ?? 0)
    const completion = Number(u.output_tokens ?? 0)
    return { prompt, completion, total: prompt + completion }
  }
  const prompt = Number(u.prompt_tokens ?? 0)
  const completion = Number(u.completion_tokens ?? 0)
  return { prompt, completion, total: Number(u.total_tokens ?? prompt + completion) }
}

/** True when a non-pro user has consumed at least `monthlyLimit` total tokens this calendar month. */
/** Monthly token cap for a tier: Free 100k, Pro 2M by default; env-overridable; 0 = unlimited. */
function monthlyLimitFor(tier: 'free' | 'pro'): number {
  const raw = tier === 'pro'
    ? Deno.env.get('PRO_TIER_MONTHLY_TOKEN_LIMIT')
    : Deno.env.get('FREE_TIER_MONTHLY_TOKEN_LIMIT')
  const fallback = tier === 'pro' ? 2_000_000 : 100_000
  return raw === undefined || raw === '' ? fallback : Number(raw)
}

/** True when the user has consumed at least their tier's monthly cap this calendar month. */
// deno-lint-ignore no-explicit-any
async function tierOverBudget(admin: any, userId: string): Promise<boolean> {
  const { data: sub } = await admin.from('subscriptions').select('tier').eq('user_id', userId).maybeSingle()
  const tier: 'free' | 'pro' = sub?.tier === 'pro' ? 'pro' : 'free'
  const limit = monthlyLimitFor(tier)
  if (limit <= 0) return false // unlimited for this tier

  const monthStart = new Date()
  monthStart.setUTCDate(1)
  monthStart.setUTCHours(0, 0, 0, 0)

  const { data: rows } = await admin
    .from('token_usage_logs')
    .select('total_tokens')
    .eq('user_id', userId)
    .gte('created_at', monthStart.toISOString())

  const used = (rows ?? []).reduce(
    (sum: number, row: { total_tokens?: number }) => sum + (row.total_tokens ?? 0),
    0,
  )
  return used >= limit
}

function buildVendorCall(
  vendor: VendorConfig,
  apiKey: string,
  payload: ProxyRequest,
): { url: string; headers: Record<string, string>; body: Record<string, unknown> } {
  if (vendor.wire === 'gemini') {
    // Google's generateContent: system prompt is `systemInstruction`, roles are user/model, and the
    // key travels as a header. When webSearch is requested we attach the google_search grounding tool.
    const system = payload.messages
      .filter((message) => message.role === 'system')
      .map((message) => message.content)
      .join('\n\n')
    const contents = payload.messages
      .filter((message) => message.role !== 'system')
      .map((message) => ({
        role: message.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: message.content }],
      }))

    return {
      url: `${vendor.url}/models/${encodeURIComponent(payload.model)}:generateContent`,
      headers: {
        'content-type': 'application/json',
        'x-goog-api-key': apiKey,
        ...vendor.extraHeaders,
      },
      body: {
        systemInstruction: system ? { parts: [{ text: system }] } : undefined,
        contents,
        tools: payload.webSearch ? [{ google_search: {} }] : undefined,
        generationConfig: {
          temperature: payload.temperature,
          maxOutputTokens: payload.maxTokens,
        },
      },
    }
  }

  if (vendor.wire === 'anthropic') {
    // Anthropic: system prompt is a top-level field, not a message.
    const system = payload.messages
      .filter((message) => message.role === 'system')
      .map((message) => message.content)
      .join('\n\n')
    const messages = payload.messages
      .filter((message) => message.role !== 'system')
      .map((message) => ({ role: message.role, content: message.content }))

    return {
      url: vendor.url,
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': ANTHROPIC_VERSION,
        ...vendor.extraHeaders,
      },
      body: {
        model: payload.model,
        max_tokens: payload.maxTokens ?? 1024,
        temperature: payload.temperature,
        system: system || undefined,
        messages,
      },
    }
  }

  // OpenAI-compatible: system messages are supported natively.
  return {
    url: vendor.url,
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${apiKey}`,
      ...vendor.extraHeaders,
    },
    body: {
      model: payload.model,
      messages: payload.messages,
      temperature: payload.temperature,
      max_tokens: payload.maxTokens,
    },
  }
}

// deno-lint-ignore no-explicit-any
function parseOpenAi(data: any): string | undefined {
  return data?.choices?.[0]?.message?.content
}

// deno-lint-ignore no-explicit-any
function parseGemini(data: any): string | undefined {
  const parts = data?.candidates?.[0]?.content?.parts
  if (!Array.isArray(parts)) return undefined
  return parts.map((part: { text?: string }) => part?.text ?? '').join('')
}

// deno-lint-ignore no-explicit-any
function parseAnthropic(data: any): string | undefined {
  return Array.isArray(data?.content)
    ? data.content
        .filter((block: { type?: string }) => block?.type === 'text')
        .map((block: { text?: string }) => block.text ?? '')
        .join('')
    : undefined
}

async function safeDetail(response: Response): Promise<string> {
  try {
    const raw = await response.text()
    const parsed = JSON.parse(raw)
    const message = parsed?.error?.message ?? parsed?.message ?? parsed?.error
    return typeof message === 'string' ? message : raw.slice(0, 200)
  } catch {
    return ''
  }
}
