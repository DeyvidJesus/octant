# Technical Debt Audit

This document is a brutally honest Staff Engineer audit of the Octant codebase. It categorizes the most severe technical debt accumulated during the platform's transition from a local-first prototype (Dexie) to a cloud-native architecture (Supabase). 

Nothing is sugarcoated. These are the barriers preventing Octant from scaling securely and sustainably.

## Status (as of 2026-09)

The audit below is kept as written. This table records what happened to each issue since.

| # | Issue | Status | Where |
|---|---|---|---|
| 1 | JSON blob synchronization | ✅ Mostly resolved: discoveries, knowledge base, interview prep and tailored résumés are one row per entity | migrations 0002, 0003, 0005, 0006 |
| 2 | Missing indexes | ✅ Resolved | 0001, plus indexes in later migrations |
| 3 | Client-side AI execution | ✅ Resolved: vendor keys only in the `ai-proxy` Edge Function, with a per-plan monthly token budget | `supabase/functions/ai-proxy` |
| 4 | No schema validation of JSONB | ⏳ **Open**: RLS limits *who* writes, not *what*; `pg_jsonschema` not enabled | — |
| 5 | DB logic inside stores | ✅ Resolved: repository layer, plus lint rules that keep UI away from it | `src/repositories`, `.oxlintrc.json` |
| 6 | Redundant auth checks | ✅ Resolved: in-memory session mirror | `src/services/supabase/session.ts` |
| 7 | Duplicated provider logic | ✅ Resolved: shared OpenAI-compatible adapter + server proxy | `src/services/ai/providers` |
| 8 | Legacy migration logic | ✅ Resolved (see below) | — |
| 9 | Knowledge-base editor gap | ✅ Resolved; relation pickers (fact → role/project) still missing | `src/modules/knowledge-base` |

---

## 1. Architecture & Scalability

### Issue 1: "Fat Client" JSON Blob Synchronization
* **Description**: The application relies on Zustand stores holding the entire user state in memory. Mutations fire `.upsert({ state: get() })` directly to Supabase, writing massive JSON blobs (e.g., `discoveries`, `resumes`) into single table rows.
* **Why it matters**: Concurrent writes will silently clobber data (last-write-wins across the entire object). As the user interacts with the app (e.g., swiping hundreds of jobs in Discovery), the client must re-upload the entire multi-megabyte array over the network for every single swipe.
* **Severity**: CRITICAL
* **Business Impact**: Severe data loss, laggy UI on low-end devices, huge network egress costs, and eventual hard PostgreSQL failures when rows hit JSON limits.
* **Difficulty**: Hard
* **Recommended Fix**: Dissolve singleton JSON tables (`discoveries`, `resumes`, `interview_preps`). Normalize them into relational PostgreSQL tables and implement paginated, relational data fetching.
* **Priority**: P0 (Must fix before launch)

### Issue 2: Missing Database Indexes
* **Description**: Every relational query in the application relies on `supabase.from('...').eq('user_id', user.id)`. However, there are no secondary indexes on `user_id` across critical tables (`jobs`, `applications`, `job_analyses`).
* **Why it matters**: PostgreSQL is forced to perform a full sequential table scan on every read query.
* **Severity**: HIGH
* **Business Impact**: As the user base grows, database CPU utilization will spike exponentially, leading to universal service degradation and high infrastructure costs.
* **Difficulty**: Easy
* **Recommended Fix**: Execute `CREATE INDEX idx_user_id ON table(user_id)` across all relational tables.
* **Priority**: P0

---

## 2. Security

### Issue 3: Client-Side AI Execution
* **Description**: All interactions with external LLMs (OpenAI, Claude, etc.) execute directly from the browser using `fetch` inside `src/services/ai/providers/`.
* **Why it matters**: In a true SaaS model, this requires either distributing the company's master API keys to the client (instant compromise) or forcing the user to bring their own keys (BYOK). Furthermore, client-side HTTP calls to AI vendors routinely fail due to CORS restrictions.
* **Severity**: CRITICAL
* **Business Impact**: Complete lack of telemetry, inability to monetize or enforce token rate limits, and massive vulnerability to key theft.
* **Difficulty**: Medium
* **Recommended Fix**: Migrate all AI execution to Supabase Edge Functions. The React client should only dispatch the payload; the Edge function securely fetches API keys, proxies the request, and enforces rate limits.
* **Priority**: P0

### Issue 4: Blind Database Trust (No Schema Validation)
* **Description**: Supabase accepts incoming JSON payloads directly from the client without backend validation.
* **Why it matters**: A malicious or bugged client can write completely malformed data to `resumes.knowledge_base`. When the app reloads, it attempts to parse this broken JSON, resulting in a fatal unrecoverable crash for that user.
* **Severity**: HIGH
* **Business Impact**: Data corruption causing permanent account lockouts.
* **Difficulty**: Medium
* **Recommended Fix**: Implement the `pg_jsonschema` extension in PostgreSQL and add triggers to validate the JSON structure before any row is committed.
* **Priority**: P1

---

## 3. Maintainability & Code Quality

### Issue 5: Database Mutation Logic Leaking into UI State
* **Description**: Zustand store mutators contain hardcoded Supabase querying logic. 
* **Why it matters**: The UI state layer is tightly coupled to the database technology. This violates separation of concerns, makes offline-queuing impossible, and makes unit testing the stores a nightmare.
* **Severity**: HIGH
* **Business Impact**: Extremely slow feature velocity. Changing a database column requires rewriting complex UI state logic.
* **Difficulty**: Medium
* **Recommended Fix**: Abstract a dedicated Repository Layer (e.g., `JobRepository.ts`). Zustand should call `await JobRepository.upsert(job)` instead of touching the `supabase` client directly.
* **Priority**: P1

### Issue 6: Redundant Authentication Checks
* **Description**: Every time a Zustand store mutates data, it executes `await supabase.auth.getUser()` before firing the `.upsert()` call. 
* **Why it matters**: This generates a massive amount of unnecessary network chatter. A user clicking a toggle 5 times generates 5 identical network requests to GoTrue auth servers just to verify they are still logged in.
* **Severity**: HIGH
* **Business Impact**: UI lag and unnecessary rate-limit triggers against Supabase Auth.
* **Difficulty**: Easy
* **Recommended Fix**: Auth state should be established once at the `AuthContext` layer and injected into the Repositories or stores, rather than polling over the network on every click.
* **Priority**: P1

### Issue 7: Duplicated AI Provider Logic
* **Description**: Inside `src/services/ai/providers/`, the adapters for OpenAI, OpenRouter, and Local instances heavily duplicate `fetch` configuration, JSON parsing logic, and HTTP error handling.
* **Why it matters**: If an improvement to error handling or a retry mechanism needs to be added, it has to be duplicated across 4 different files.
* **Severity**: MEDIUM
* **Business Impact**: Increased bug surface area.
* **Difficulty**: Easy
* **Recommended Fix**: Extract the network logic into a base `AiHttpClient` utility.
* **Priority**: P2

---

## 4. Performance & Developer Experience

### Issue 8: Legacy Migration Logic in the Critical Path
* **Description**: `migrateV2ToV3` logic is still present and executed when the `resumeStore` initializes.
* **Why it matters**: Dead code related to previous Dexie versions is unnecessarily taking up memory and CPU cycles during app initialization.
* **Severity**: LOW
* **Business Impact**: Minor performance hit on load; pollutes the developer experience with legacy context.
* **Difficulty**: Easy
* **Recommended Fix**: Now that the migration to Supabase is complete, purge all Dexie dependencies, backup/restore logic, and V2 migration code entirely.
* **Priority**: P3
* **Status**: ✅ RESOLVED (Phase 8). Dexie deps/files, the `*Migrations.ts` chain, and `migrateV2ToV3` were deleted. Because `migrateV2ToV3` doubled as the runtime bridge behind the `/resume` Master Resume editor, retiring it also retired that editor — which introduced **Issue 9** below.

---

## 5. Product & Functionality Gaps

### Issue 9: Knowledge Base Editing Coverage Gap (No In-App Editor for Core Resume Data)
* **Description**: Phase 8 retired the projection-based Master Resume editor (`/resume`, `MasterResumePage`) together with its `updateResume` → `migrateV2ToV3` bridge. The surviving cloud-native editor — the Knowledge Base page (`/knowledge`, `KnowledgeBasePage`) — only authors a **subset** of the `CareerKnowledgeBase`. Several core collections now have **no in-app editor at all**.
* **What is still editable** (`/knowledge`): `facts`, `technicalDecisions`, `stories`, `metrics`, `learning`, and the triage inbox (`unclassifiedFacts`).
* **What is NO LONGER editable in the UI**: `profile` (personal info, summary, career direction, values, work preferences), `organizations`, `roles` (experience), `initiatives` (projects), `skills`, `credentials` (certifications + education), `languages`, `portfolioAssets`, and `publications`. `patchKnowledgeBase` can still write these collections, but no component calls it for them anymore — `updateResume` was their only writer.
* **Why it matters**: These collections are the structural backbone the resume projection is built from. With no editor, a user can only obtain this data via **seed data, cross-device realtime sync, or a future import** — they cannot create or correct their own profile, experience, or skills in the app. The relational tables from Phase 5 (`resume_organizations`, `resume_roles`, `resume_skills`, `resume_facts`) already exist and can hold the data; **the gap is purely the missing UI, not storage.**
* **Downstream impact**:
  * **Resume generation** ([projection.ts](../src/services/resume/projection.ts) → [generate.ts](../src/services/generator/generate.ts)): tailored resumes are only as complete as the projection, which is starved of experience/skills a user can't enter.
  * **Job matching** ([match.ts](../src/services/analysis/match.ts)): ATS/match scoring reads the same projection, so match quality degrades for anyone past the seed data.
  * **Interview prep** and **discovery scoring** ([scoreCandidates.ts](../src/services/discovery/scoreCandidates.ts)): both consume `state.resume`; thinner data → weaker output.
  * **New-user onboarding**: the value proposition ("we tailor resumes and match you to jobs") is blocked until the user's real history is in the system.
* **Severity**: HIGH (core new-user functionality; not a data-integrity risk — no data is lost, it simply can't be authored).
* **Business Impact**: New users hit a wall entering their own career data; resume tailoring and matching underperform until this is closed.
* **Difficulty**: Medium.
* **Possible Solutions**:
  1. **Extend the Knowledge Base editor (recommended).** Add sections/tabs to `/knowledge` for the uncovered collections (Profile, Experience = organizations + roles, Projects = initiatives, Skills, Credentials, Languages, Portfolio, Publications). Reuse the existing `KnowledgeList` chrome and route edits through `patchKnowledgeBase`, which already persists per-row diffs via `KnowledgeBaseRepository.applyChanges` (Phase 5). Lowest risk, cloud-native, no new store surface, no projection round-trip.
  2. **Dedicated Profile/Experience editor that edits the KB directly.** A focused new module that calls `patchKnowledgeBase({ organizations, roles, skills, ... })` on the real collections — *not* the old lossy `projection → migrateV2ToV3` round-trip that motivated the retirement. Cleaner than the old editor; more work than option 1.
  3. **AI-assisted intake.** A "paste your résumé / LinkedIn" flow that runs an extraction task to populate `profile`/`organizations`/`roles`/`skills`/`facts` into the KB (reusing the existing extraction infrastructure in `services/ai/tasks`). Complements manual editing and accelerates onboarding; should pair with 1 or 2 so the result is correctable.
  4. **Accept the gap (not recommended).** Only viable if career data is expected to arrive exclusively via seed/import/sync. Ships a real hole in the product for hand-entry users.
* **Recommended Fix**: Option 1 as the primary closure (extend `/knowledge`), optionally paired with Option 3 for fast onboarding.
* **Priority**: P1 (blocks new-user value; schedule right after the current architecture hardening).
* **Status**: ✅ RESOLVED via Option 1. The Knowledge Base page now has editor tabs for **Profile** (identity, summary, values, work preferences, languages), **Experience** (organizations + roles, with a role→organization picker), **Projects** (initiatives), **Skills**, **Credentials** (certifications + education), **Portfolio**, and **Publications** — all reusing the `KnowledgeList` pattern and persisting through `patchKnowledgeBase` (per-row diffed writes for the relational collections; residual document for the rest). Structural collections are fully hand-editable again.
* **Remaining limitation (pre-existing, not from Phase 8)**: like the original Fact/Metric/etc. editors, the new sections edit scalar fields, tags, status, and the single role→org FK — but **not** the many-to-many id-array links (`fact.roleIds`, `initiative.technologySkillIds`, `portfolioAsset.initiativeIds`). Practical effect: a manually-created role won't show bullets until its facts carry its `roleId`, which no editor sets today. Closing this needs relationship pickers (a role/skill multi-select) added to the Fact/Project editors — a focused follow-up, tracked separately from the Phase 8 gap.
