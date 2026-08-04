# AI Refactoring Playbook

This document contains a structured, copy-pasteable playbook of prompts designed to guide an AI agent (like Claude, ChatGPT, or Cursor) through fixing the entirety of Octant's technical debt and executing the full 90-day roadmap to a production-ready public launch.

Do not dump all these prompts into the AI at once. AI models perform best with focused, scoped context. Start a new chat, paste the **Global Context**, and then execute the phases one by one.

---

## 0. Global Context (Paste this first)

*Paste this into the system prompt, project context, or as the very first message in your AI chat.*

```markdown
### Project Context: Octant
Octant is an AI-powered Career Operating System.
- **Tech Stack**: React 19, TypeScript, Vite, Tailwind CSS v4, Zustand (state), Supabase (Postgres & GoTrue Auth).
- **Current State**: The platform recently migrated from local-first (Dexie.js) to cloud-first (Supabase). However, it carried over severe technical debt: it operates as a "Fat Client", syncing massive JSON blobs (like the entire resume graph) into single database rows via Zustand `.upsert()` calls. AI queries are executed directly from the browser, exposing API keys. UI state is tightly coupled to raw database queries.

### Your Role
You are the Lead Staff Engineer. We are executing a massive refactoring roadmap to achieve a production-ready, scalable SaaS architecture. I will give you specific phases to execute. Write production-ready, strictly typed TypeScript and PostgreSQL. Do not change the UI design; focus purely on architecture, state management, and backend logic. Let me know when you are ready for Phase 1.
```

---

## Phase 1: Database Stabilization (Missing Indexes)

*Wait for the AI to acknowledge the context, then send this:*

```markdown
**PHASE 1: Database Stabilization**

Currently, our Supabase queries rely heavily on `auth.uid() = user_id`. However, there are no secondary indexes on `user_id` across our core relational tables (`jobs`, `applications`, `job_analyses`), causing massive sequential scans.

1. Write a Supabase SQL migration script (`supabase/migrations/0001_add_user_indexes.sql`) to create secondary indexes on the `user_id` column for the `jobs`, `applications`, and `job_analyses` tables.
2. Add an index to the `status` and `stage` columns on `jobs` and `applications` respectively, as we often filter by these on the frontend.
```

---

## Phase 2: The Repository Layer

```markdown
**PHASE 2: Decoupling Zustand from Supabase**

Currently, all our Zustand stores (e.g., `src/stores/jobsStore.ts`, `src/stores/applicationsStore.ts`) execute raw `supabase.from('...').upsert()` directly inside their mutator functions. This tightly couples our UI to our DB and prevents offline queueing.

1. Create a new directory: `src/repositories/`.
2. Implement a `JobRepository.ts` and `ApplicationRepository.ts`. 
3. These files should export classes or objects that wrap the `supabase` client (from `src/services/supabase/client.ts`). They must handle CRUD operations (`getJobs`, `upsertJob`, `deleteJob`), handle Supabase errors gracefully by throwing standard App Errors, and return strongly-typed data.
4. Refactor `src/stores/jobsStore.ts` and `src/stores/applicationsStore.ts` to import and use these Repositories instead of calling `supabase` directly.
```

---

## Phase 3: Removing Auth Polling

```markdown
**PHASE 3: Removing Redundant Auth Checks**

Currently, every mutator inside our Zustand stores executes `await supabase.auth.getUser()` to get the `user_id` BEFORE executing a database write. If a user clicks a button 5 times, it fires 5 network requests to the auth server.

1. We already have an `AuthContext.tsx` that listens to `onAuthStateChange`.
2. Refactor the Zustand stores (or the new Repository layer from Phase 2) so that they do NOT call `supabase.auth.getUser()` over the network on every write.
3. Instead, the current `user_id` should be injected into the Repositories, or the Repositories should implicitly rely on the Supabase client's internal local session state. 
4. Show me the refactored code for `resumeStore.ts` and `generatorStore.ts` implementing this fix.
```

---

## Phase 4: Normalizing "Discoveries" (JSON Blob Destruction)

```markdown
**PHASE 4: Relational Normalization for Discoveries**

The `discoveries` table in Supabase currently holds a single row per user, where the `state` column (JSONB) holds arrays containing thousands of scraped, pending, and rejected jobs. When a user swipes on one job, the client re-uploads the entire multi-megabyte array.

1. Write a Supabase SQL migration to create a new table: `discovered_jobs`. It should have `id`, `user_id`, `url`, `status` (pending, approved, rejected), `data` (jsonb payload for the scraped content), and `created_at`. Enable RLS on `user_id`.
2. Create a `DiscoveryRepository.ts` to interface with this new relational table (using `.range()` for pagination).
3. Refactor `src/stores/discoveryStore.ts` to completely stop syncing a massive JSON object. It should now manage a small local queue of jobs, fetching the next page from the Repository when the queue runs low, and firing individual `UPDATE` calls to the Repository when a job is rejected or approved.
```

---

## Phase 5: Normalizing the Master Resume

```markdown
**PHASE 5: Relational Normalization for the Knowledge Base**

Similar to Phase 4, the `resumes` table stores the entire `CareerKnowledgeBase` graph as a single JSONB blob.

1. Write a Supabase SQL migration to create relational tables: `resume_organizations`, `resume_roles`, `resume_facts`, and `resume_skills`. Set up the appropriate foreign keys (e.g., `resume_facts` linking to `resume_roles`). Enable RLS.
2. Create a `KnowledgeBaseRepository.ts` that handles fetching this relational data and constructing the in-memory graph for the client.
3. Refactor `src/stores/resumeStore.ts` to use this Repository. Updates to a specific bullet point should now trigger an `UPDATE` on a single row in `resume_facts`, rather than re-uploading the entire resume tree.
```

---

## Phase 6: Edge Function AI Proxy

```markdown
**PHASE 6: Securing AI Execution**

Currently, `src/services/ai/providers/` executes `fetch` requests to OpenAI and Claude directly from the browser, exposing API keys and triggering CORS failures.

1. Write a Supabase Edge Function (`supabase/functions/ai-proxy/index.ts`) using Deno. 
2. The function should accept a `CompletionRequest` JSON payload, verify the user's Supabase JWT authorization header, read the vendor API keys from the Edge environment variables (`Deno.env.get('OPENAI_API_KEY')`), make the fetch call to the vendor, and return the response.
3. Refactor `src/services/ai/providers/openAiCompatible.ts` and `claude.ts` in the React frontend to remove direct vendor URLs and API keys. They must now POST to the new Supabase Edge Function URL.
```

---

## Phase 7: Realtime Sync

```markdown
**PHASE 7: Cross-Device Synchronization**

Currently, Octant requires a hard refresh to sync data across devices. 

1. Update the Repositories (`JobRepository.ts` and `ApplicationRepository.ts`) to implement Supabase Realtime subscriptions.
2. When the `jobs` or `applications` table changes (INSERT, UPDATE, DELETE) for the authenticated `user_id`, the Repository should dispatch an event.
3. Update the Zustand stores to listen to these Repository events and seamlessly update the in-memory state without requiring a manual refresh.
```

---

## Phase 8: Legacy Code Cleanup

```markdown
**PHASE 8: Purging Dexie & Legacy Migrations**

We have successfully migrated entirely to Supabase.
1. Remove all Dexie.js dependencies from `package.json`.
2. Delete any local database initialization files related to Dexie.
3. In `src/stores/resumeStore.ts` (and any other stores), remove the `migrateV2ToV3` logic that was previously used to transition users from local storage. The codebase should now assume a cloud-native starting point.
```

---

## Phase 9: Serverless PDF Export

```markdown
**PHASE 9: Serverless PDF Export (ATS Safety)**

Currently, exporting a tailored resume relies on client-side rendering which varies by browser and OS, creating risks for ATS parsers.

1. Create a Supabase Edge Function (`supabase/functions/export-pdf/index.ts`) using Puppeteer or Playwright running in a serverless environment.
2. The function should accept the `TailoredResume` JSON.
3. It must inject a strictly standardized HTML/CSS template optimized for ATS parsers, render it to a PDF buffer, and return the binary.
4. Update the frontend export button to call this Edge Function and trigger a file download for the user.
```

---

## Phase 10: Interview OS Upgrade

```markdown
**PHASE 10: Dynamic Interview Simulation**

Currently, Interview Prep uses hardcoded question banks (`behavioralBank.ts`) and relies on manual self-rating.

1. Break the `interview_preps` JSON blob into normalized Postgres tables (`user_skills`, `mock_interviews`, `mock_answers`). Write the SQL migrations.
2. Update the AI Edge Function (from Phase 6) to support a new `InterviewGenerator` task. It should take the user's Master Resume and the missing skills from a Job Description to dynamically generate targeted interview questions.
3. Integrate the existing `interviewCoach.ts` into a closed-loop system: when a user submits an answer, the AI evaluates it, and the resulting score automatically updates their mastery level in the new `user_skills` Postgres table.
```

---

## Phase 11: Billing & RBAC

```markdown
**PHASE 11: Monetization via Stripe & Row Level Security**

Octant needs to become a paid SaaS.

1. Implement Stripe Checkout in the frontend. 
2. Create a Supabase Edge Function (`supabase/functions/stripe-webhook/index.ts`) to listen for `customer.subscription.created` and `deleted` events.
3. Update the `users` or a new `subscriptions` table to reflect the user's tier (e.g., `free`, `pro`).
4. Write Postgres RLS (Row Level Security) policies that enforce role-based access control. For example, Free users should only be able to create a maximum of 3 `jobs` and 1 `tailored_resume`. Pro users have unlimited access.
```

---

## Phase 12: Analytics & Telemetry

```markdown
**PHASE 12: Application Health & AI Budget Tracking**

To safely launch, we need visibility into app health and AI API consumption.

1. Integrate PostHog into the React application to track core funnel events (e.g., `resume_generated`, `job_applied`).
2. Integrate Sentry to catch frontend crashes and unhandled promise rejections.
3. In the AI Edge Function (from Phase 6), add logic to log AI token consumption into a Supabase `token_usage_logs` table. This is critical to monitor if a specific user is burning through our OpenAI API budget so we can enforce rate limiting based on their Stripe tier.
```
