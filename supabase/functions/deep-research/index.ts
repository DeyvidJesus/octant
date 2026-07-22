// Supabase Edge Function: deep-research
//
// Phase 13 — securing Deep Research. The Gemini "interactions" (Deep Research) agent used to be called
// straight from the browser with a VITE_-bundled key: the key leaked into the client bundle AND the
// browser was CORS-blocked from the vendor anyway, so the feature never actually worked in-app. This
// function is the server-side seam: it verifies the caller's Supabase JWT, injects GEMINI_API_KEY held
// ONLY in the Edge environment, forwards start/poll to Google, and returns the raw interaction JSON
// (the client keeps its resilient polling/backoff loop). The key never touches the client.
//
// Deploy:  supabase functions deploy deep-research
// Secrets: supabase secrets set GEMINI_API_KEY=...
// (SUPABASE_URL and SUPABASE_ANON_KEY are injected automatically.)

import { createClient } from 'jsr:@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

const BASE = 'https://generativelanguage.googleapis.com/v1beta/interactions'
const AGENT = 'deep-research-preview-04-2026'

interface DeepResearchRequest {
  action: 'start' | 'poll'
  prompt?: string
  interactionId?: string
}

Deno.serve(async (req: Request): Promise<Response> => {
  const cors = corsHeaders(req)
  const json = (body: unknown, status = 200): Response =>
    new Response(JSON.stringify(body), { status, headers: { ...cors, 'content-type': 'application/json' } })

  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'Method not allowed.' }, 405)

  // 1. Verify the caller's Supabase JWT.
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return json({ error: 'Missing authorization header.' }, 401)

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    { global: { headers: { Authorization: authHeader } }, auth: { persistSession: false } },
  )
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return json({ error: 'Invalid or expired session.' }, 401)

  // 2. Parse the request.
  let payload: DeepResearchRequest
  try {
    payload = await req.json()
  } catch {
    return json({ error: 'Invalid JSON body.' }, 400)
  }

  const apiKey = Deno.env.get('GEMINI_API_KEY')
  if (!apiKey) return json({ error: 'Server is missing GEMINI_API_KEY.' }, 500)

  const headers = { 'content-type': 'application/json', 'x-goog-api-key': apiKey }

  // 3. Forward to Google and return the raw interaction JSON (the client parses status/steps/error).
  try {
    if (payload.action === 'start') {
      if (typeof payload.prompt !== 'string' || !payload.prompt.trim()) {
        return json({ error: 'A prompt is required to start Deep Research.' }, 400)
      }
      const upstream = await fetch(BASE, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          agent: AGENT,
          input: payload.prompt,
          background: true,
          store: true,
          agent_config: { type: 'deep-research' },
          tools: [{ type: 'google_search' }],
        }),
      })
      return relay(upstream, json)
    }

    if (payload.action === 'poll') {
      if (typeof payload.interactionId !== 'string' || !payload.interactionId) {
        return json({ error: 'An interactionId is required to poll Deep Research.' }, 400)
      }
      const upstream = await fetch(`${BASE}/${encodeURIComponent(payload.interactionId)}`, {
        method: 'GET',
        headers,
      })
      return relay(upstream, json)
    }

    return json({ error: `Unknown action: ${String(payload.action)}` }, 400)
  } catch (err) {
    return json({ error: 'Could not reach the Deep Research provider.', detail: String(err) }, 502)
  }
})

/** Pass the vendor status through, but always as JSON with CORS headers. */
async function relay(
  upstream: Response,
  json: (body: unknown, status?: number) => Response,
): Promise<Response> {
  let data: unknown
  try {
    data = await upstream.json()
  } catch {
    return json({ error: `Deep Research provider returned a non-JSON response (HTTP ${upstream.status}).` }, 502)
  }
  return json(data, upstream.status)
}
