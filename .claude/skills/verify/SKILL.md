---
name: verify
description: Build, launch, and drive Octant end-to-end in a headless browser (Supabase mocked) to verify changes at the UI surface.
---

# Verifying Octant

Octant is a React SPA backed by Supabase (Postgres + Auth + Realtime + Edge Functions). To drive it
locally without touching a real project, run the Vite dev server with **no `.env`** and mock the whole
backend from Playwright. Never point a verification run at the production project.

## Launch

```bash
yarn dev    # Vite on http://localhost:5173 (background)
```

With `VITE_SUPABASE_URL` unset, `src/services/supabase/client.ts` falls back to
`http://localhost:54321` with a dummy key (and logs a warning). That origin is what you intercept.

## Drive (headless browser)

Use the `playwright` npm package with the system Chrome, installed in a scratch dir, not in this repo:

```js
import { chromium } from 'playwright'
const browser = await chromium.launch({ channel: 'chrome', headless: true })
```

Listen to `pageerror` and `console.error`: a broken route or a React warning fails silently otherwise.

## Mocking Supabase

- **Session:** before the app loads (`page.addInitScript`), write a session into localStorage under
  `sb-localhost-auth-token` (supabase-js derives it as `sb-${hostname.split('.')[0]}-auth-token`): an
  unsigned JWT with a far-future `exp` and `sub` = the user id, `expires_at` far in the future, and a
  `user` with `email_confirmed_at` set. `getSession()` then returns it without a network call.
- **REST** (`http://localhost:54321/rest/v1/<table>`): serve in-memory tables with `eq/neq/in/is`,
  `order` and `limit`. `.maybeSingle()` sends a plain Accept header and takes the first array element,
  so return an array (`[]` = no row); only `.single()` sends `application/vnd.pgrst.object+json`
  (return one object, or 406). Make POSTs upsert so reads keep working after writes.
- **Tables the app reads on login:** jobs, job_analyses, applications, tailored_resumes, resumes
  (`knowledge_base`), resume_organizations, resume_roles, resume_skills, resume_facts, discovered_jobs,
  discoveries (`state`), discovery_runs, discovery_signals, user_skills, settings, subscriptions,
  search_profiles. Rows are `{ id, user_id, data }` unless the repository says otherwise
  (`src/repositories/*`).
- **Edge Functions (gotcha):** with the env unset, function URLs are *relative*
  (`/functions/v1/...` on :5173), so intercept both origins. Return `{amount, currency, interval}` for
  `get-plan-pricing`, an error for `ai-proxy` unless the flow needs a canned completion, `200 {}` otherwise.
- **Realtime:** `page.routeWebSocket(/localhost:54321\/realtime/)` and acknowledge joins and heartbeats
  (frames are `[join_ref, ref, topic, event, payload]`).
- **Keep the discovery heartbeat quiet:** seed a `discovery_runs` row with `status: 'succeeded'` and a
  recent `finished_at` (and tier `pro`, 1 h cadence), or it starts a run 2.5 s after load.
- **Skip onboarding:** `settings.preferences.onboardingCompleted = true`.

## Fixtures

Build them with the app's own code so shapes are exact: bundle a small script with esbuild
(`--alias:@=<repo>/src --define:import.meta.env={}`) that uses `createSeedKnowledgeBase`,
`projectKnowledgeBase`, `getAnalyzer().analyze`, `splitKnowledgeBase` (knowledge base → rows),
`generateTailoredResume` and `generatePrep`. Job descriptions under 200 characters get no ATS score by
design, so write longer ones.

## Gotchas

- The shell is `h-screen` with its own scrolling `<main>`, so Playwright's `fullPage` captures one
  screen; for a tall shot, resize the viewport to `main.scrollHeight`.
- React StrictMode runs effects twice in dev: an error that only appears in dev is often a missing
  cleanup (see the `disposed` guard in `AuthContext.tsx`).
- Don't run `tsc -b` and `vitest` in the same compound command — vitest fails spuriously.
