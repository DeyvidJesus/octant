# CareerOS — Staff Engineer Design Review

_Reviewed at the end of Increment #1 (foundation). Scope: the whole codebase, judged against the stated ambition — a tool used daily for years, scaling to thousands of records, many AI providers, and eventually a SaaS._

The foundation is sound: clean module boundaries, a real persistence layer, a deterministic analyzer, and honest behavior (no faked AI). This review is not "the code is bad" — it is "here is what will bend or break as the ambition grows, and the order to reinforce it." Increment #1 deliberately chose simple options (whole-document storage, a single analyzer function); several of those choices are now worth revisiting _because the stated scale changed_, not because they were wrong for their scope.

## Priority summary

| # | Finding | Area | Priority |
|---|---------|------|----------|
| 1 | Master Resume model is too flat to be a real single source of truth | Data model | **Critical** |
| 2 | AI layer needs a general provider interface, not just the analyzer seam | AI | **Critical** |
| 3 | No way to add a job / paste a real JD — the core loop is a demo | UX | **Critical** |
| 4 | Whole-document storage won't hold documents + a searchable knowledge base | Architecture | High |
| 5 | Analyzer treats all keywords equally (no must-have vs nice-to-have) | Job analysis | High |
| 6 | No keyboard navigation / command palette | UX | High |
| 7 | No tests on the load-bearing pure logic | Code quality | High |
| 8 | No schema-migration strategy for years of evolving data | Architecture | High |
| 9 | Resume generation must be spec'd as selection, never generation | Generation | High |
| 10 | Analyses are single-slot; no history as the resume evolves | Data model | Medium |
| 11 | Career-intelligence modules — pick the derived-data ones first | Product | Medium |
| 12 | Loading/streaming/optimistic states absent (fine until AI lands) | UX | Medium |
| 13 | Minor: duplication, naming, lazy routes, light mode | Quality/Perf | Low |

---

## 1. Architecture

### 1.1 Whole-document storage will not scale to documents + search — High
**Problem.** Every store persists via Zustand `persist`, which serializes the _entire_ store to one IndexedDB row on every mutation and rehydrates the whole blob on load. Adding one application to a list of 1,000 re-serializes and rewrites all 1,000. There are no indexes, so any search must load everything into memory and scan.
**Why it matters.** At 1,000 applications (~1 MB) this is tolerable. It breaks down exactly where the ambition points: "hundreds of resumes" and "thousands of stored documents" (generated resumes/cover letters, each 5–20 KB) become a multi-MB blob rewritten on every keystroke-triggered autosave, and the Knowledge Base needs full-text search that whole-document can't index.
**Proposed solution.** Keep whole-document for _singletons_ (`resume`, `settings`). Move _collections_ (applications, jobs, analyses, and the future documents/notes) to per-entity Dexie tables behind a thin `Repository<T>` seam; keep Zustand as an in-memory view/cache hydrated from repository queries. Dexie gives indexes (`by-stage`, `by-updatedAt`, full-text via a token index) essentially for free. This is a _thin_ repository (get/put/delete/query), not an ORM.
```ts
interface Repository<T extends { id: string }> {
  get(id: string): Promise<T | null>
  put(entity: T): Promise<void>
  delete(id: string): Promise<void>
  query(filter?: (t: T) => boolean): Promise<T[]>   // Dexie where() under the hood
}
```
**Expected impact.** Constant-time writes, indexed reads, real search — the prerequisites for the Knowledge Base and Documents modules. Also the natural sync boundary for a future SaaS.
**Do it** before the Documents (#5) / Knowledge Base modules land — not today. Don't rip out working stores prematurely; introduce the repository when the first document-heavy collection needs it, and migrate applications/jobs at the same time to set the pattern.

### 1.2 No schema-migration strategy — High
**Problem.** Persistence versioning is just Zustand's `version: 1`; there is no plan for evolving the shape of stored data over years.
**Why it matters.** The Master Resume model _will_ change (see §4). Without migrations, a shape change either crashes on old data or silently drops fields — unacceptable for the one artifact the user can least afford to lose.
**Proposed solution.** A single `migrate(persistedState, fromVersion)` per store (Zustand supports this), plus a top-level `schemaVersion` in the backup envelope (already present) with an import-time migration chain. Keep migrations pure and tested.
**Impact.** Safe evolution; backups from any version remain restorable.

### 1.3 Coupling: analyses live inside the jobs store — Medium
**Problem.** `analyses: Record<jobId, JobAnalysis>` is embedded in `jobsStore`.
**Why it matters.** Fine now, but analyses are the natural place for history (§10) and will be consumed by resume generation and interview prep. Embedding them in the jobs document couples their growth to the jobs blob.
**Proposed solution.** When §1.1 lands, analyses become their own repository keyed by id with a `jobId` index; the store exposes `analysesForJob(jobId)`.
**Impact.** Independent growth, history support, cleaner cross-module consumption.

---

## 2. AI Experience

### 2.1 Generalize the seam: `AIProvider`, not just `JobAnalyzer` — Critical (design now, build with first consumer)
**Problem.** The `JobAnalyzer` interface is the right shape for _analysis_, but resume generation, interview prep, and cover letters all need LLM calls too. Without a general layer, each module will grow its own provider glue.
**Why it matters.** The stated goal is Claude, GPT, Gemini and future providers behind identical interfaces. That requires one provider abstraction plus task services built on top — designed before the second AI consumer exists, or divergence is locked in.
**Proposed solution.** A three-layer AI design:

```ts
// Layer 1 — provider (one adapter per vendor, normalizes their API to this)
interface AIMessage { role: 'system' | 'user' | 'assistant'; content: string }
interface AICompletionRequest {
  messages: AIMessage[]
  model: string
  temperature?: number
  maxTokens?: number
  signal?: AbortSignal
}
interface AIProvider {
  readonly id: 'anthropic' | 'openai' | 'google' | string
  readonly models: string[]
  complete(req: AICompletionRequest): Promise<AICompletionResult>
  stream(req: AICompletionRequest): AsyncIterable<AIStreamChunk>
  // Structured output validated against a JSON schema; provider uses native
  // tool/JSON mode where available, falls back to parse-and-validate.
  completeStructured<T>(req: AICompletionRequest, schema: JSONSchema): Promise<T>
}

// Layer 2 — prompt templates (versioned, testable, provider-agnostic)
interface PromptTemplate<Ctx> {
  id: string
  version: number
  build(ctx: Ctx): AIMessage[]
}

// Layer 3 — task services (what modules actually call)
interface JobAnalyzer { analyze(ctx: AnalyzerContext): Promise<JobAnalysis> }   // today: local; later: LLMJobAnalyzer using Layer 1+2
interface ResumeGenerator { generate(ctx: GenerationContext): Promise<TailoredResume> }
```

- **Retry**: exponential backoff on 429/5xx in a `withRetry()` wrapper at the provider layer, not per call site.
- **Streaming**: `stream()` yields chunks; long generations (resume, cover letter) render progressively.
- **Structured output**: the LLM analyzer returns the _same_ `JobAnalysis` shape the local one already produces — the UI never branches on provider.
- **Hallucination prevention (structural, provider-independent)**: keep the §match invariant — `matched` and every generated bullet must be validated against the Master Resume after the model returns. The model _proposes_ wording; code _verifies_ the underlying fact exists. This is the single most important rule in the product and must live in code, not in the prompt.
- **Keys**: stored in `settings` (localStorage/IndexedDB) with a plain-language warning; provider + model selectable in Settings.

**Expected impact.** Any provider drops in behind `getProvider(settings)`; every AI feature inherits retry, streaming, validation, and the anti-invention guarantee for free.
**Note.** Do _not_ build this in a vacuum today (nothing consumes it → churn risk). Build Layer 1+2 alongside the first real AI feature. The design above is the contract to build against.

### 2.2 Prompt templates belong in `constants/` / `services/ai/prompts/`, versioned — High (with 2.1)
Version prompts (`resume-tailor@3`) and snapshot the version used into each generated artifact, so you can reproduce or diff outputs when a prompt changes. Cheap now, invaluable after a year of tweaks.

---

## 3. Master Resume (the heart of the product)

### 3.1 The model is too flat to be a true single source of truth — Critical
**Problem.** Today: `personal, summary, goals, values, experience[], projects[], skills[]`, where accomplishments are plain `bullets: string[]` and skills are plain strings. The user's brief asks it to hold accomplishments, STAR stories, measurable impact, certifications, publications, learning history, portfolio assets, leadership, interview examples — each stored once and _extracted_ by generators.
**Why it matters.** Plain-string bullets can't be selected, ranked, or matched by the generator — so tailoring degrades into rewriting prose rather than choosing the most relevant _facts_. Plain-string skills can't carry proficiency/recency, which blocks skill-gap analysis. This flat model is the ceiling on everything downstream.
**Proposed solution.** Promote the reusable units to first-class, tagged, uniquely-stored entities; experiences/projects reference them; generators select by tag + relevance. Proposed shape:

```ts
interface Accomplishment {          // the atomic, reusable resume unit
  id: string
  text: string                      // canonical phrasing (generator may rewrite emphasis)
  skills: string[]                  // canonical skill ids used
  metric?: string                   // "improved LCP 40%", "cut build 6m→90s"
  keywords: string[]
  experienceId?: string             // where it happened
}
interface Skill {
  id: string; canonical: string; category: SkillCategory
  proficiency?: 1 | 2 | 3 | 4 | 5
  yearsUsed?: number; lastUsedYear?: number
  favorite?: boolean
}
interface StarStory {               // powers behavioral interviews AND resume bullets
  id: string; title: string
  situation: string; task: string; action: string; result: string
  skills: string[]; competencies: string[]      // "leadership", "conflict"
  experienceId?: string; tags: string[]
}
interface Certification { id: string; name: string; issuer: string; issuedAt: string; expiresAt?: string; credentialId?: string; url?: string }
interface Education { id: string; institution: string; degree: string; field: string; start: string; end?: string }
interface Publication { id: string; title: string; venue: string; date: string; url?: string; description?: string }
interface LearningEntry { id: string; title: string; provider: string; completedAt?: string; skills: string[]; url?: string; notes?: string }  // learning history + ROI
interface PortfolioAsset { id: string; title: string; type: 'repo' | 'live' | 'writeup' | 'talk'; url: string; tags: string[] }
interface Language { name: string; level: string }   // English C1 → structured
```
Experiences keep `company/role/duration` but their bullets become `accomplishmentIds` (or inline `Accomplishment[]`). Everything claimable is an entity with `skills`/`keywords`/`metric`, so the generator can _select and rank_ truthfully.
**Expected impact.** This is the enabler for truthful tailoring, skill-gap analysis, interview prep from real stories, and metrics. It is the correct foundation for Increment #2 (the editor), which should be built on this model, not the flat one.
**Impact on existing code**: `collectResumeSkills` gets richer signal; seed data expands; the read-only display gains sections. Contained, but it _is_ Increment #2's scope — build the model first, then the editor.

### 3.2 One canonical summary, generator produces variants — informational
Keep a single canonical `summary`; do not store per-target summaries in the Master Resume. Variants are generation outputs (stored as Documents), never source of truth. This preserves "everything exists once."

---

## 4. Resume Generation (spec for Increment #5)

### 4.1 Define it as deterministic selection + rewrite, never creation — High
**Problem/Why.** The prototype fabricated resumes; that's gone, but the replacement must be specified so it can never regress. The value is a truthful, ATS-friendly, one-page tailoring.
**Proposed solution (pipeline).**
1. Input: `MasterResume` + a `JobAnalysis`.
2. **Select**: rank accomplishments/projects/skills by (keyword overlap with JD × importance) + recency + presence of a metric. Drop low-relevance items to fit one page.
3. **Reorder**: most-relevant experience bullets first; skills reordered to lead with `matched` required skills.
4. **Rewrite (optional, AI layer)**: rephrase _selected_ bullets for tone/keywords — with the post-generation validator asserting every rewritten bullet still maps to a source `Accomplishment.id`. No new facts.
5. Output: a `TailoredResume` Document (markdown + print CSS one-pager) carrying `{ sourceItemIds[], jobId, promptVersion?, atsScoreAfter }` for traceability.
**Impact.** Truthful by construction; every line traceable to a stored fact; ATS score measurably improved by leading with required-keyword matches.

---

## 5. Job Analysis

### 5.1 No must-have vs nice-to-have distinction — High (implementing now)
**Problem.** Every detected keyword is weighted equally. A JD's "5+ years React (required)" and "Rust a plus" score identically, and gaps don't distinguish "you're missing a hard requirement" from "missing a bonus."
**Why it matters.** This is the difference between the analyzer being "a keyword counter" and "better than reading the JD myself" — the stated bar for this module.
**Proposed solution.** Segment the JD, detect optional-markers ("nice to have", "bonus", "a plus", "preferred", "ideally"), classify each skill `required | preferred`, weight the ATS score toward required coverage, and split gaps into must-have gaps (high concern) vs nice-to-have gaps.
**Impact.** Sharper score, honest gap triage, actionable prep. **Implemented in this pass.**

### 5.2 Requirement vs responsibility, company/recruiter signals — Medium
Detect "responsibilities/what you'll do" vs "requirements/what you need" sections; surface company signals (stage, team size, remote policy) and recruiter intent (urgency, growth) — these mostly want the AI layer (§2) to do well; ship heuristic versions where cheap.

---

## 6. Career Intelligence (product)

### 6.1 Build the derived-data modules first — Medium
Prioritize modules that compute from data you already own, not ones needing external feeds:
- **Application analytics** (funnel, response rate, time-in-stage, match-score vs outcome) — pure derivation, high daily value.
- **Interview history** (per-application rounds, questions asked, self-rated answers) — feeds prep, compounds over time.
- **Skill-gap analysis** (aggregate `missing` across analyzed jobs → what to learn for the roles you target) — the single most strategic view; directly serves the "become architect/CTO" goal.
Defer external-data modules (salary/market trends, company database, recruiter CRM, networking tracker) — they add maintenance and data-sourcing burden for lower marginal insight early on.

---

## 7. Performance

### 7.1 Don't optimize yet; two cheap wins later — Low
Rendering is fine (small lists, memo not needed). When routes grow, `React.lazy` the heavier modules (Generator, Knowledge Base). The real perf lever is §1.1 (storage), not React. No action now.

---

## 8. UX

### 8.1 Can't add a job or paste a JD — Critical
**Problem.** The board shows seed jobs with synthetic descriptions; there is no "Add opportunity / paste JD." For daily use the primary input is missing — you analyze against pseudo-text, not the real posting.
**Why it matters.** This is the top of the core loop (paste JD → analyze → tailor → track). Without it the app is a demo of itself.
**Proposed solution.** "Add opportunity" with a paste-JD textarea (Increment #3), and let the analyzer run on the pasted text. High priority because it unblocks real use.
**Impact.** The loop becomes real.

### 8.2 No keyboard navigation / command palette — High
**Problem.** Navigation is mouse-only; no `⌘K`.
**Why it matters.** A tool used every day lives or dies on speed of navigation and repeated actions (jump to a job, start an analysis, add an application).
**Proposed solution.** A command palette (`⌘K`) over routes + entities + actions ("Analyze <company>", "New application"), and `g d`/`g j` style nav. Build on a small primitive (one dependency, e.g. `cmdk`) rather than hand-rolling focus management.
**Impact.** Order-of-magnitude faster daily flow.

### 8.3 Loading / streaming / empty-state dead-ends — Medium
Analysis is instant now (local), so the "Analyzing…" state barely shows — but when AI lands, wire real streaming + skeletons. The jobs empty-state currently dead-ends ("arrives in an upcoming increment"); once §8.1 ships it should point to "Add opportunity." Onboarding: a first-run checklist ("import a resume or edit the Master Resume → add a job → analyze") would orient a new user (and any future SaaS signup).

---

## 9. Code Quality

### 9.1 No tests on load-bearing pure logic — High (implementing now)
**Problem.** The analyzer (`extract`, `match`) and `backup` are pure, deterministic, and central — and untested. A regression here silently corrupts scores or backups.
**Proposed solution.** Vitest suite over `services/analysis` and `services/storage/backup`, asserting the invariants (matched ⊆ resume; determinism; seniority detection; importance classification; backup round-trip + rejection of foreign files).
**Impact.** The guarantees the product depends on become executable and regression-proof. **Implemented in this pass.**

### 9.2 Minor cleanups — Low
`ProfileCard` uses `React.ReactNode` (global) while the codebase prefers explicit `type` imports — align for consistency. The `Field` label pattern is duplicated between `ProfileCard` and the editor to come — extract a `Field` primitive when the editor lands (not before). Naming is clear throughout; no action urgent.

---

## 10. Analyses are single-slot — Medium
**Problem.** `analyses[jobId]` holds one analysis; re-running overwrites.
**Why it matters.** As the Master Resume improves, re-analyzing the same job _should_ show the score trend ("your changes moved Addi 64% → 79%") — a motivating, strategic signal. Overwriting loses it.
**Proposed solution.** With §1.1, store analyses as a history keyed by id with `jobId` + `analyzedAt`; UI shows latest with a sparkline of past scores.
**Impact.** Turns analysis from a snapshot into a feedback loop on resume improvement.

---

## 11. Product Thinking (toward SaaS)

Decisions worth making now because they make the SaaS future cheap:
- **Keep the `Repository`/`KeyValueStore` seam (§1.1)** — it is the exact line where a synced backend swaps in. Per-entity records with `id` + `updatedAt` enable conflict-resolvable sync; whole-document blobs don't.
- **Keep domain `types/` UI- and storage-agnostic** — they become the shared contract between a future client and server.
- **Version prompts and snapshot them into outputs (§2.2)** — reproducibility is a support/quality feature at scale.
- **Backup/restore already gives data portability** — keep it first-class; it doubles as export/GDPR later.
- Do _not_ add multi-user, auth, or a server now — that is premature. The above are zero-cost-now, high-leverage-later.

---

## Recommended order

1. **Now (this pass, safe & contained):** §5.1 must-have/nice-to-have analysis + §9.1 tests.
2. **Increment #2 (next, needs your input):** build the richer Master Resume model (§3.1) _then_ its editor. This is the highest-leverage foundation and the reason to decide the model before writing the editor.
3. **Increment #3:** §8.1 add/paste JD + analyzer v2 (§5.2), and introduce the `Repository` seam (§1.1) as collections start to matter.
4. **Then:** command palette (§8.2), resume generation spec (§4) with the AI layer (§2) built alongside its first consumer, career-intelligence derived modules (§6.1).

The through-line: **make the Master Resume a rich, structured single source of truth, and make everything else select from it.** That is where "dramatically more useful" comes from.
