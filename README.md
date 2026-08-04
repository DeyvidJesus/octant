# Octant

A local-first personal Career Operating System. The **Master Resume** is the single source of
truth; job analysis, tailored resumes, interview preparation, application tracking, and career
metrics all derive from it.

All data lives on this device (IndexedDB). Export a JSON backup regularly from **Settings**.

## Stack

- React 19 + TypeScript + Vite
- Tailwind CSS v4 (CSS-first config, design tokens in `src/styles/index.css`)
- Zustand (persisted stores) + Dexie (IndexedDB) behind a `KeyValueStore` seam
- react-router-dom

## Architecture

```
src/
├── app/          # Router + layout shell
├── components/   # Shared, domain-agnostic UI primitives (ui/) and layout (layout/)
├── modules/      # One folder per product module (pages + module-specific components)
├── services/     # Framework-free logic: storage/, analysis/ (analyzer seam), ai/ (provider seam)
├── stores/       # Zustand stores: resume, jobs (+analyses), applications, settings
├── types/        # Domain types — zero dependencies
├── constants/    # Seed data, skill taxonomy, navigation, application stages
└── utils/
```

Rules:

- `services/` never imports React; `types/` imports nothing.
- `components/ui` is domain-agnostic; module-specific components live inside their module.
- The analyzer is behind the `JobAnalyzer` interface (`services/analysis/types.ts`). Today it's a
  deterministic local heuristic; an LLM-backed analyzer can plug in later without touching the UI.
  Structural guarantee: `match.matched` is always a set intersection of JD skills ∩ resume skills —
  no analyzer can invent experience.

### AI layer (`services/ai/`)

Provider-agnostic and hybrid by design. Nothing in the app names a vendor.

- **Providers are plugins.** Every vendor implements one `LLMProvider` adapter (`providers/`):
  Claude, OpenAI, Gemini, OpenRouter, and any local OpenAI-compatible server (Ollama/LM Studio).
  Adding a vendor is a descriptor in `registry.ts` + an adapter — no UI or task changes. The model
  field is free text, so new models work the day they ship.
- **Deterministic owns truth; the LLM owns language.** `services/analysis/` computes scoring,
  matching, and keywords and never imports `services/ai/`. Tasks in `ai/tasks/` consume that
  structured output and do only what humans are good at (judgment, rewriting, explanation).
- **The anti-hallucination guardrail is code, not a prompt** (`guardrails/grounding.ts`). Generated
  text is scanned with the same taxonomy extractor used for analysis; any skill it names that isn't
  in the Master Resume ∪ the job description is flagged to the user as unverified. The structured
  model always wins.
- **Keys never leave the device.** API keys live in a vault (`vault.ts`) under a non-`careeros:`
  prefix, so they are structurally excluded from exported backups. Everything degrades gracefully:
  with no provider configured, all deterministic features work unchanged.
- First task shipped: **Recruiter Read** — turns the deterministic match report into a recruiter's
  honest interview verdict (see the Job Analysis page).

### Job Discovery (`/jobs/discovery`)

Real openings flow in from three sources, all through one pipeline:
`extract (LLM transcribes → code validates) → dedupe (deterministic, vs board/queue/dismissed) →
local ATS scoring → review queue`. Nothing reaches the board without explicit approval —
quality over quantity, enforced by flow.

- **Paste Report** (free): paste a Gemini Deep Research run from the Gemini app — its Scheduled
  Actions can produce one daily. Works with any configured provider, including local models.
- **Web Sweep** (~cents): a search-grounded completion finds current postings matching your
  Master Resume + discovery preferences (Settings). Requires a provider with the
  `supportsWebSearch` capability (Gemini today). Non-capable adapters throw rather than
  hallucinate listings.
- **Deep Research** (~$1–3, 5–20 min): an in-app exhaustive research agent on your Gemini key.
  Async and resumable — the interaction id persists across reloads.

"Daily" in a local-first app = an opt-in staleness banner on the board when the last sweep
is >24h old. Nothing runs (or spends) in the background.

### Resume Generator (`/generator`)

Deterministic tailoring — the generator **selects, ranks, and reorders** real Master Resume
content per job; it cannot write a word of its own. Every bullet carries the id of its source
accomplishment (traceability = the anti-invention guarantee, `types/generator.ts`).

- Relevance scoring mirrors the ATS score's weighting (required×2, frequency), so "relevant"
  means the same thing in both places (`services/generator/score.ts`).
- Live **keyword coverage meter**: recomputed from included content on every bullet toggle —
  trimming a line shows its ATS cost immediately.
- ATS-safe paper: single column, no tables/icons/colors; print CSS strips all app chrome so
  Print → Save as PDF ships exactly the preview. Markdown + plain-text exports for web forms.
- Staleness detection: the document remembers the Master Resume `updatedAt` it was built from.

## Development

```bash
npm install
npm run dev      # start dev server
npm run build    # typecheck + production build
npm run lint     # oxlint
```

## Roadmap

1. ✅ Foundation (scaffold, persistence, local analyzer)
2. ✅ Master Resume editor (full rich entity model + CRUD)
3. ✅ Job Opportunities (paste real JDs, must-have/nice-to-have analysis)
4. ✅ AI provider layer (provider-agnostic adapters, guardrails, key vault, Recruiter Read) +
   Job Discovery (paste/sweep/Deep Research → review queue) + Resume Generator (deterministic
   tailoring with live coverage meter, print/PDF + markdown export)
5. ✅ Application Tracker (board + table views, drag-to-move stages, rich fields — contacts,
   comp/logistics, follow-ups with overdue surfacing, and a per-application activity timeline)
6. ✅ Career Metrics + Dashboard v2 (funnel & conversion, response/offer/ghost rates, stage
   velocity, activity + match-score trends — Recharts on the dark theme; dashboard shows a
   pipeline + activity preview)
7. ✅ Interview Preparation (deterministic technical/behavioral/system-design questions with
   model answers, persisted per-question progress + readiness dashboard, and a grounded AI
   practice coach) — pulled ahead of #5/#6
8. Knowledge Base + Repository/Dexie-tables migration
9. Polish (keyboard navigation, command palette, accessibility, light mode)

See `docs/DESIGN_REVIEW.md` for the full architectural review that shapes this roadmap.
