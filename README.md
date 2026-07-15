# Career OS

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
├── services/     # Framework-free logic: storage/ (persistence seam), analysis/ (analyzer seam)
├── stores/       # Zustand stores: resume, jobs (+analyses), applications
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

## Development

```bash
npm install
npm run dev      # start dev server
npm run build    # typecheck + production build
npm run lint     # oxlint
```

## Roadmap

1. ✅ Foundation (scaffold, persistence, local analyzer)
2. Master Resume editor (full CRUD)
3. Job Opportunities (paste real JDs, analyzer v2)
4. Application Tracker (rich fields, stages, follow-ups)
5. Resume Generator (deterministic tailoring — selection/reordering only)
6. Career Metrics + Dashboard v2
7. Interview Preparation
8. Knowledge Base + AI provider plug-in point
9. Polish (keyboard navigation, command palette, accessibility, light mode)
