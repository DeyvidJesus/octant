import { createClient } from '@supabase/supabase-js'

// Local Supabase (`supabase start`) defaults — used only in dev when the vars are unset.
const LOCAL_URL = 'http://localhost:54321'
const LOCAL_ANON_KEY = 'dummy_key'

const envUrl = import.meta.env.VITE_SUPABASE_URL
const envAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// Production builds fail fast instead of silently pointing at localhost; dev falls back with a warning.
if (import.meta.env.PROD && (!envUrl || !envAnonKey)) {
  throw new Error(
    'Missing VITE_SUPABASE_URL and/or VITE_SUPABASE_ANON_KEY. Set both (Netlify env / .env) before building for production.',
  )
}
if (import.meta.env.DEV && (!envUrl || !envAnonKey)) {
  // eslint-disable-next-line no-console -- config diagnostic, dev-only
  console.warn(
    '[supabase] VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY not set — falling back to local Supabase (http://localhost:54321).',
  )
}

const supabaseUrl = envUrl || LOCAL_URL
const supabaseAnonKey = envAnonKey || LOCAL_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
