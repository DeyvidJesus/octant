# CareerOS Engineering Documentation

Welcome to the CareerOS engineering docs. If you are a new software engineer joining the team, **start here**.

This document explains what we are building, how it is built, and where the project stands today.

---

## What is CareerOS?

CareerOS is a personal Career Operating System designed to orchestrate the entire job-hunting lifecycle. Rather than managing scattered documents and spreadsheets, CareerOS centralizes everything around a single source of truth.

## Product Vision

The vision is simple: **The Master Resume (Knowledge Base) is the definitive source of truth.** 

Everything else—job analysis, tailored resumes, interview preparation, application tracking, and career metrics—automatically derives from this central repository. By combining deterministic matching algorithms with pluggable AI capabilities, CareerOS helps users apply smarter and faster without hallucinations or invented experiences.

## Current Maturity Level

**Post-Migration Prototype.** 

The application recently underwent a massive architectural shift from a local-first offline tool (using IndexedDB/Dexie) to a fully cloud-native application backed by Supabase PostgreSQL. 
While all core features are shipped and functional, the codebase retains significant technical debt from its prototype phase (e.g., legacy data migration loops, optimistic UI updates without robust fallback syncing). It is functional in production but requires structural maturation.

## Main Features

1. **Master Resume & Knowledge Base**: A centralized, rich entity model of a user's entire career history.
2. **Job Discovery & Analysis**: Ingests job descriptions (via pasting, web sweeps, or deep research) and runs a deterministic gap analysis against the Master Resume.
3. **AI-Driven Insights**: Features like "Recruiter Read" provide honest feedback using pluggable LLMs.
4. **Resume Generator**: Deterministically tailors a resume for a specific job by ranking, reordering, and selecting facts from the Master Resume. It calculates live ATS keyword coverage.
5. **Application Tracker**: A Kanban and table view of ongoing applications with stage velocity and timeline tracking.
6. **Interview Prep**: Generates technical and behavioral questions with model answers, grounded in the user's specific experience.
7. **Career Metrics**: Dashboards detailing funnel conversions, response rates, and ghosting trends.

---

## High-Level Architecture

CareerOS uses an **optimistic-UI, store-driven architecture**.

The user interface (`modules`) never directly fetches data from the backend. Instead, UI components subscribe to global Zustand `stores`. When a user takes an action, the store instantly mutates local memory (providing immediate UI feedback) and then blindly fires an asynchronous request to our `services` layer (Supabase) to persist the change in the cloud.

The AI capabilities are abstracted away behind a unified service layer, meaning the core logic of the app is entirely vendor-agnostic.

## Technology Stack

* **Core**: React 19 + TypeScript + Vite
* **Styling**: Tailwind CSS v4 (CSS-first config)
* **State Management**: Zustand (Aggressive client-side stores)
* **Backend & Auth**: Supabase (PostgreSQL + GoTrue Auth)
* **Routing**: React Router DOM v7
* **Charts**: Recharts
* **Tooling**: Oxlint (linting), Vitest (testing)

## Folder Overview

```text
src/
├── app/          # App shell, root routing, and global layouts
├── components/   # Shared, domain-agnostic UI primitives (buttons, inputs)
├── modules/      # Feature modules (one folder per domain: auth, job-discovery, etc.)
├── services/     # Framework-free external communication (Supabase API, AI providers)
├── stores/       # Zustand state management (resume, jobs, applications)
├── types/        # TypeScript interfaces and domain types
├── constants/    # Seed data, taxonomies, and static configurations
└── utils/        # Helper functions and date/formatting utilities
```

---

## Current Strengths

* **Pluggable AI Architecture**: The AI integration is isolated. You can swap between Anthropic, OpenAI, Google, or local models strictly by altering the configuration registry.
* **Strict Anti-Hallucination Guardrails**: The LLM does not own the truth, the deterministic code does. If an AI generates a resume bullet with a skill not found in the user's Master Resume, the system flags it. 
* **Strict Feature Boundaries**: Modules (`src/modules/*`) are highly decoupled from one another, making it easy to build in parallel.

## Current Limitations

* **Scalability Debt (Fragile Syncing)**: Because stores update local state immediately and do "fire-and-forget" updates to Supabase, any network failure results in permanent silent data drift.
* **Production Debt (Store/API Coupling)**: Stores contain hardcoded Supabase `.upsert` calls instead of calling an abstracted repository API layer. 
* **Security Debt (Client Trust)**: The application pushes massive JSON tree blobs from the client directly into the Supabase database. There is minimal backend validation of the JSON schema, trusting the client implicitly.

---

## Glossary of Important Concepts

* **Knowledge Base (KB)**: The raw, comprehensive data structure storing every job, project, and fact about a user's career.
* **Master Resume**: A runtime-only, projected view of the Knowledge Base formatted cleanly for the resume generator.
* **Tailored Resume**: A job-specific snapshot of the Master Resume, where irrelevant bullets and projects are toggled off. 
* **Deterministic Analyzer**: The hardcoded local heuristic that compares a job description's required skills against a user's known skills.
* **Deep Research**: An exhaustive, long-running (5-20 min) background AI agent process that uses Google Gemini to find jobs on the web.

---

## Where to Start Reading the Code

To understand how the app boots and routes:
👉 `src/app/routes.tsx`

To understand the core data structure that drives the entire product:
👉 `src/stores/resumeStore.ts`

To understand how AI connects to the platform without breaking things:
👉 `src/services/ai/registry.ts`

## Reading Order

Now that you understand what CareerOS is, your next required reading is the architectural deep-dive to see exactly how these pieces communicate:

**Next:** Read `docs/architecture.md`
