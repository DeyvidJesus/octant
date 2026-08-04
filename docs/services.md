# Octant Services Architecture

The `src/services/` directory is the engine room of Octant. Unlike `modules` or `stores`, this layer is strictly **React-free**. It isolates business logic, external API integrations, and heavy data transformations. 

This document breaks down every service cluster, its responsibilities, dependencies, purity, and identified technical debt.

---

## 1. AI Service (`src/services/ai/`)
* **Purpose**: Orchestrates all LLM interactions in a vendor-agnostic way.
* **Responsibilities**: Defines prompt structures via "Tasks", maps them to vendor-specific payloads via "Providers", and applies deterministic verification via "Guardrails".
* **Inputs**: Unified `AiRunConfig` and domain context (e.g., job descriptions, resume text).
* **Outputs**: Strongly typed JSON objects or verified text strings.
* **Dependencies**: External APIs (OpenAI, Anthropic, Google Gemini), environment variables.
* **Consumers**: Job Discovery module, Interview Prep module, UI actions requiring text refinement.
* **Side effects**: Extensive network I/O, API credit consumption.
* **Purity**: **Impure** (Network-bound).
* **Testability**: Tested via mocked HTTP endpoints or stubbed responses.
* **Duplicated Logic**: The `providers/` adapters (specifically `openai.ts`, `openrouter.ts`, and `openAiCompatible.ts`) heavily duplicate `fetch` configuration, request body mapping, and HTTP error handling.
* **Future Improvements**: Abstract the HTTP `fetch` logic into a single internal base `AiHttpClient` to centralize retries, timeouts, and JSON parsing across all providers.

## 2. Analysis Service (`src/services/analysis/`)
* **Purpose**: The deterministic brain evaluating job fit.
* **Responsibilities**: Executes local heuristics to extract required skills from Job Descriptions and matches them perfectly against the Master Resume to compute ATS scores.
* **Inputs**: Job description string, `MasterResume` skills arrays.
* **Outputs**: `JobAnalysis` object with numeric scores and categorized matching data.
* **Dependencies**: Internal taxonomies.
* **Consumers**: `jobsStore`, Job Analysis feature module.
* **Side effects**: None.
* **Purity**: **100% Pure**.
* **Testability**: Easily tested using static JSON inputs and verifying expected numeric outputs.
* **Future Improvements**: The local heuristic uses strict string-matching. A semantic layer (e.g., mapping "React.js" to "React") is needed to improve ATS matching accuracy without relying on an external LLM call.

## 3. Applications Service (`src/services/applications/`)
* **Purpose**: State transition logic for the application pipeline.
* **Responsibilities**: Builds pipeline event objects (status changes, follow-up notes).
* **Inputs**: Raw event arguments and ISO timestamps.
* **Outputs**: `Partial<Application>` patch objects.
* **Dependencies**: `utils/id.ts`.
* **Consumers**: `applicationsStore`.
* **Side effects**: None.
* **Purity**: **Pure** (timestamps are injected as inputs).
* **Testability**: High.
* **Future Improvements**: This service is extremely thin. The logic is so simple it borders on over-abstraction and could arguably live directly inside the `applicationsStore` mutators.

## 4. Discovery Service (`src/services/discovery/`)
* **Purpose**: Validates incoming job scrapes before they reach the user's queue.
* **Responsibilities**: Deduplicates candidate jobs against previously dismissed roles or existing board applications.
* **Inputs**: Raw scraped job arrays.
* **Outputs**: Filtered, scored arrays of unique jobs.
* **Dependencies**: None.
* **Consumers**: `discoveryStore`.
* **Side effects**: None.
* **Purity**: **Pure**.

## 5. Generator Service (`src/services/generator/`)
* **Purpose**: The engine powering tailored resumes.
* **Responsibilities**: Scores the relevance of Master Resume bullets against a specific Job Analysis, reorders them for impact, calculates real-time ATS keyword coverage, and exports the final document to Markdown.
* **Inputs**: `MasterResume` object, `JobAnalysis` object.
* **Outputs**: `TailoredResume` object, Markdown string.
* **Dependencies**: None.
* **Consumers**: `generatorStore`, Markdown/PDF export UI.
* **Side effects**: None.
* **Purity**: **100% Pure** (Deterministic).
* **Testability**: Highly testable.

## 6. Interview Prep Service (`src/services/interviewPrep/`)
* **Purpose**: Manages the question banks and progression logic for interview prep.
* **Responsibilities**: Houses hardcoded behavioral/technical question banks and implements pure reducers to handle mastery tracking and note-taking.
* **Inputs**: Job contexts, previous `ProgressMap` state.
* **Outputs**: Filtered `PrepQuestion` arrays, updated `ProgressMap`.
* **Dependencies**: Seed data.
* **Consumers**: `interviewPrepStore`.
* **Side effects**: None.
* **Purity**: **Pure**.

## 7. Knowledge Service (`src/services/knowledge/`)
* **Purpose**: Entity classification for raw user data.
* **Responsibilities**: Takes unstructured facts input by the user and maps them into specific taxonomies (e.g., tagging a bullet as a "leadership" skill vs. a "technical" skill).
* **Inputs**: Fact strings.
* **Outputs**: Categorized entity tags.
* **Dependencies**: None.
* **Consumers**: Master Resume (Knowledge Base editor).
* **Side effects**: None.
* **Purity**: **Pure**.

## 8. Resume Service (`src/services/resume/`)
* **Purpose**: Data projection core.
* **Responsibilities**: Acts as a strict bridge that flattens the complex `CareerKnowledgeBase` tree into the simplified `MasterResume` format expected by downstream consumers (like the generator and UI). It acts as a strict filter preventing malformed or pending facts from leaking into a resume.
* **Inputs**: `CareerKnowledgeBase`.
* **Outputs**: `MasterResume`.
* **Dependencies**: None.
* **Consumers**: `resumeStore`.
* **Side effects**: None.
* **Purity**: **100% Pure**.
* **Testability**: High.

## 9. Supabase Service (`src/services/supabase/`)
* **Purpose**: Database and backend connectivity configuration.
* **Responsibilities**: Initializes and exports the singleton Supabase client used to communicate with the PostgreSQL backend and GoTrue Auth layer.
* **Inputs**: Environment variables (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`).
* **Outputs**: Configured `supabase` client instance.
* **Dependencies**: `@supabase/supabase-js`.
* **Consumers**: All Zustand stores, Auth module.
* **Side effects**: Opens network sockets, reads/writes to localStorage (for auth tokens).
* **Purity**: **Highly Impure**.
* **Future Improvements**: 
  * **Critical Architecture Debt**: Right now, this service only exports a naked `client`. Consequently, every Zustand store executes hardcoded `.upsert` calls inline. 
  * **Suggested Abstraction**: This service should export strictly-typed **Repositories** (e.g., `JobRepository.upsert(job)`). This would remove all raw SQL-like querying from the Zustand UI state layer and centralize data fetching, error handling, and offline queuing.
