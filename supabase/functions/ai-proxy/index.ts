// Supabase Edge Function: ai-proxy
//
// Phase 6 — Securing AI Execution. Hosted-vendor completions used to run straight from the browser,
// which shipped API keys to the client and hit vendor CORS. This function is the server-side seam:
// it verifies the caller's Supabase JWT, injects vendor API keys held ONLY in the Edge environment,
// makes the vendor call, and returns a normalized `{ text, model }` result. Keys never touch the
// client, and the browser talks to a same-trusted origin so CORS is a non-issue.
//
// Deploy:  supabase functions deploy ai-proxy
// Secrets: supabase secrets set OPENAI_API_KEY=... ANTHROPIC_API_KEY=... OPENROUTER_API_KEY=...
// (SUPABASE_URL and SUPABASE_ANON_KEY are injected automatically.)

import { createClient } from 'jsr:@supabase/supabase-js@2'

type ProviderId = 'openai' | 'openrouter' | 'claude'
type Wire = 'openai' | 'anthropic'

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
}

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, content-type',
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'content-type': 'application/json' },
  })
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS })
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
  if (payload.webSearch) {
    // Matches the frontend guard: these providers cannot ground on live search.
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

  // Tier-aware rate limit. Enforced only when FREE_TIER_MONTHLY_TOKEN_LIMIT is set (>0); otherwise
  // we log usage but never block. Pro users are always unlimited.
  const monthlyLimit = Number(Deno.env.get('FREE_TIER_MONTHLY_TOKEN_LIMIT') ?? '0')
  if (monthlyLimit > 0 && (await freeTierOverBudget(admin, user.id, monthlyLimit))) {
    return json(
      { error: 'Monthly AI usage limit reached on the Free plan. Upgrade to Pro for unlimited AI.' },
      429,
    )
  }

  // 3. Build and make the vendor call.
  const { headers, body } = buildVendorCall(vendor, apiKey, payload)
  let vendorResponse: Response
  try {
    vendorResponse = await fetch(vendor.url, { method: 'POST', headers, body: JSON.stringify(body) })
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
  const text = vendor.wire === 'anthropic' ? parseAnthropic(data) : parseOpenAi(data)
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
  } catch (_err) {
    // swallow
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
// deno-lint-ignore no-explicit-any
async function freeTierOverBudget(admin: any, userId: string, monthlyLimit: number): Promise<boolean> {
  const { data: sub } = await admin.from('subscriptions').select('tier').eq('user_id', userId).maybeSingle()
  if (sub?.tier === 'pro') return false

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
  return used >= monthlyLimit
}

function buildVendorCall(
  vendor: VendorConfig,
  apiKey: string,
  payload: ProxyRequest,
): { headers: Record<string, string>; body: Record<string, unknown> } {
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
