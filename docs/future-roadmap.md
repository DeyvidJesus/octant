# Octant Future Roadmap

As the Lead Engineer stepping into Octant, the goal is clear: evolve the platform from a local-first, JSON-heavy prototype into a robust, server-backed, enterprise-ready Interview & Career Operating System.

This 10-Phase roadmap outlines exactly how we get to a public launch safely.

---

## Phase 1 — Understand & Secure
**Objectives**: Eliminate existential infrastructure risks and stabilize the current database.
**Deliverables**: 
- Applied secondary indexes on `user_id` across all Postgres tables.
- Removed all legacy Dexie.js migration code.
- Created database-level JSON validation (`pg_jsonschema`).
**Prerequisites**: Access to Supabase production instance.
**Risks**: Applying schema validations might break existing user data if they have malformed JSON.
**Success criteria**: Database queries perform at `O(log N)` instead of `O(N)`. Zero Dexie dependencies in `package.json`.
**Estimated complexity**: Low
**Recommended order**: 1

## Phase 2 — Refactor (Repository Pattern)
**Objectives**: Decouple the UI state from the database.
**Deliverables**: 
- A dedicated `src/repositories/` folder.
- Zustand stores rewritten to consume Repositories instead of calling `supabase.from()`.
- Removal of redundant `supabase.auth.getUser()` calls in mutators.
**Prerequisites**: Phase 1
**Risks**: Temporary velocity slowdown while rewriting state management.
**Success criteria**: Zustand stores are 100% database-agnostic and unit testable.
**Estimated complexity**: Medium
**Recommended order**: 2

## Phase 3 — Master Resume (Data Normalization)
**Objectives**: Dissolve the massive `knowledge_base` JSON blob into relational tables.
**Deliverables**:
- New Postgres tables: `facts`, `skills`, `organizations`, `experiences`.
- Edge Function to compile and serve the `MasterResume` projection.
**Prerequisites**: Phase 2
**Risks**: High risk of data loss during the migration of existing JSON blobs to relational rows.
**Success criteria**: Updating a single resume bullet executes a targeted SQL `UPDATE` rather than re-uploading the entire resume tree.
**Estimated complexity**: High
**Recommended order**: 3

## Phase 4 — Resume Generator
**Objectives**: Standardize PDF exports and implement semantic matching.
**Deliverables**:
- Headless Chromium/Puppeteer serverless export service for pixel-perfect PDF rendering.
- Vector-embedding semantic scoring in `score.ts` (replacing strict string matching).
**Prerequisites**: Phase 3
**Risks**: Puppeteer in serverless environments often hits memory/size limits.
**Success criteria**: PDF output is identical across Chrome, Safari, and Firefox and passes standard ATS parsers perfectly.
**Estimated complexity**: High
**Recommended order**: 4

## Phase 5 — Interview Prep (The Interview OS)
**Objectives**: Transition from static study plans to a dynamic, closed-loop AI simulation.
**Deliverables**:
- Real-time AI question generator (replacing hardcoded `questionBank.ts`).
- Voice-to-text integration for practicing verbal answers.
- Automated confidence scoring linked directly to AI feedback.
**Prerequisites**: Phase 2
**Risks**: Voice parsing introduces latency; AI evaluation can be overly strict or hallucinate grading rubrics.
**Success criteria**: Users can conduct a 10-minute dynamic audio mock interview and receive a personalized weakness report.
**Estimated complexity**: Very High
**Recommended order**: 5

## Phase 6 — AI Backend (Edge Functions)
**Objectives**: Secure vendor API keys and implement rate limiting.
**Deliverables**:
- Supabase Edge Functions proxying all OpenAI/Anthropic/Gemini requests.
- Complete removal of `fetch` calls to AI vendors from the React frontend.
- Native JSON Schema structured outputs via OpenAI/Anthropic SDKs.
**Prerequisites**: Phase 1
**Risks**: Edge function cold starts introducing latency to UI interactions.
**Success criteria**: No API keys are visible in the client bundle. AI requests are rate-limited per user.
**Estimated complexity**: Medium
**Recommended order**: 6

## Phase 7 — SaaS (Thin Client & Realtime)
**Objectives**: Enable cross-device synchronization and true server-side authority.
**Deliverables**:
- Relational pagination for `discoveries` (moving off JSON arrays).
- Supabase Realtime websocket subscriptions for `jobs` and `applications`.
- Migration from `localStorage` JWTs to HTTP-only cookies (SSR Auth).
**Prerequisites**: Phase 3, Phase 6
**Risks**: Websocket connection overhead.
**Success criteria**: A user modifying a job status on their phone instantly sees the change reflect on their open laptop browser.
**Estimated complexity**: High
**Recommended order**: 7

## Phase 8 — Billing
**Objectives**: Monetize the platform.
**Deliverables**:
- Stripe integration (Checkout, Webhooks).
- Role-Based Access Control (RBAC) in Postgres (Free vs Premium users).
- Paywalls on AI usage (e.g., Premium users get 100 Interview Coach credits/month).
**Prerequisites**: Phase 6, Phase 7
**Risks**: Missed webhook events causing users to be locked out of paid tiers.
**Success criteria**: Users can successfully upgrade to a premium tier and access gated features securely enforced by RLS.
**Estimated complexity**: Medium
**Recommended order**: 8

## Phase 9 — Analytics
**Objectives**: Telemetry and application health monitoring.
**Deliverables**:
- PostHog or Amplitude integration for feature usage tracking.
- Sentry integration for frontend and Edge Function error tracking.
- AI token usage tracking per user in Supabase.
**Prerequisites**: Phase 6
**Risks**: Privacy concerns (PII leaking into analytics payloads).
**Success criteria**: Engineering has a dashboard showing exactly where AI token budgets are being spent and which features are unused.
**Estimated complexity**: Low
**Recommended order**: 9

## Phase 10 — Public Launch
**Objectives**: Scale and market the product.
**Deliverables**:
- Stress-tested infrastructure (Artillery/K6 load testing).
- Production-ready marketing site (SEO optimized).
- Finalized onboarding flow.
**Prerequisites**: Phases 1-9
**Risks**: Database locking under sudden concurrent load.
**Success criteria**: Platform survives a Product Hunt launch with < 1% error rate and zero database timeouts.
**Estimated complexity**: High
**Recommended order**: 10

---

## The First 90 Days as Lead Engineer

**Days 1–30: Stop the Bleeding**
* **Focus**: Phases 1 & 2.
* **Actions**: Add missing database indexes. Remove redundant auth checks. Strip out legacy Dexie code. Establish the Repository pattern to decouple Zustand from Supabase.
* **Goal**: Stabilize the application. Ensure that existing users experience zero data loss and the database stops relying on sequential scans.

**Days 31–60: Security & Normalization**
* **Focus**: Phases 3 & 6.
* **Actions**: Dissolve the JSON blobs. Migrate `discoveries` and `resumes` to relational tables. Move all AI execution to Edge Functions and secure the API keys. 
* **Goal**: Plug security holes. The frontend must no longer be trusted to dictate JSON schema or hold AI vendor keys.

**Days 61–90: Monetization & Feature Parity**
* **Focus**: Phases 4, 7, & 8.
* **Actions**: Implement serverless PDF generation to guarantee ATS safety. Implement Realtime sync. Integrate Stripe and lock premium features behind RLS policies.
* **Goal**: Achieve a state where the application can sustainably accept credit cards, safely generate production-grade resumes, and confidently handle cross-device usage. Ready for Phase 10 (Launch).
