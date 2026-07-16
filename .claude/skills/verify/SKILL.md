---
name: verify
description: Build, launch, and drive CareerOS end-to-end in a headless browser to verify changes at the UI surface.
---

# Verifying CareerOS

CareerOS is a local-first React SPA (Vite dev server, IndexedDB persistence, no backend).
The surface is the browser — drive it with Playwright against system Chrome.

## Launch

```bash
npm run dev                       # Vite on http://localhost:5173 (background)
```

## Drive (headless browser)

Playwright works with the system Chrome — no browser download needed:

```js
import { chromium } from 'playwright'
const browser = await chromium.launch({ channel: 'chrome', headless: true })
```

Install `playwright` (npm package only, ~2s) in a scratch dir, not in this repo.
Listen to `pageerror` and `console.error` — a broken SPA route fails silently otherwise.

## Faking the AI provider (key insight)

AI flows need no real API key: the **`local` provider** hits any OpenAI-compatible
endpoint without auth. Stand up a tiny Node http server returning a canned
`/chat/completions` response (`choices[0].message.content`), **with CORS headers**
(`access-control-allow-origin/headers/methods` + OPTIONS 204 — the app calls it
cross-origin from :5173), then configure it in the UI:

- `/settings`: `#ai-provider` → `local`, `#ai-model` → anything, `#ai-base-url` → mock URL.

For job-extraction flows the mock's message content must be a JSON array of
`{company, role, description, url, location, salaryRange, workMode}`.

## Flows worth driving

- **Paste import**: `/jobs/discovery` → fill `Research report` textarea → "Extract jobs"
  → summary line (`span.text-emerald-400`) → Review Queue cards → approve navigates
  to `/jobs/{id}/analysis` (auto-analysis runs) → board shows source badge.
- **Dedupe**: re-paste same report → "0 added · N duplicates skipped". Dismissals are
  remembered across reloads ("previously dismissed").
- **Data reset between runs**: state persists in IndexedDB; use a fresh browser context
  (Playwright default) for a clean seed-data start.

## Gotchas

- Seed data includes a Builder.io job at `https://job-boards.greenhouse.io/builder/jobs/6020728004` —
  handy as a known board-duplicate for dedupe checks.
- Descriptions under 200 chars get no ATS score (by design — "thin description" note instead).
- Don't run `tsc -b` and `vitest` in the same compound command — vitest fails spuriously.
