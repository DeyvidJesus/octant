# Supabase Architecture

Octant relies on Supabase as its primary Backend-as-a-Service (BaaS). This document covers the current Supabase implementation footprint, identified security and architectural debt, and the roadmap for evolving into a fully server-backed SaaS.

---

## 1. Current Implementation Footprint

### Authentication & Sessions
* **Current State**: Auth is handled entirely client-side using `supabase-js` communicating with GoTrue.
* **Flow**: `AuthContext.tsx` wraps the application, listening to `onAuthStateChange`. Users sign in/up via `LoginPage.tsx` using email and password.
* **Tokens**: JWTs are managed implicitly by the Supabase client and stored in the browser's `localStorage`.
* **Technical Debt**: 
  * Every mutator inside every Zustand store executes a redundant `supabase.auth.getUser()` check *before* executing a database write. This causes massive, unnecessary network chattiness on every keystroke or button click.
  * *Proposed Fix*: Auth state should be injected into the API layer once, rather than re-fetched on every action.

### Database (PostgreSQL)
* **Current State**: Used primarily as a remote JSON document store (see `database.md`). Zustand acts as an in-memory database, and mutations fire blind `.upsert()` requests to sync the state to PostgreSQL.
* **Query Patterns**: Almost exclusively `.eq('user_id', auth.uid())`.

### Row Level Security (RLS) & Policies
* **Current State**: RLS is strictly enforced on all tables. 
* **Policies**: Every table uses a uniform policy: `auth.uid() = user_id`. No user can access or modify another user's rows.
* **Missing**: No role-based access control (RBAC) is implemented yet (e.g., distinguishing between free users, premium users, and admins).

### Environment Variables
* Configuration relies on `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` exposed to the client bundle.

---

## 2. Missing Implementations

Octant currently ignores several core Supabase features that are critical for a modern SaaS:

* **Realtime**: 
  * *Current*: If a user has Octant open on a laptop and a desktop, changes do not sync automatically. The client must be hard-refreshed to trigger a fetch.
  * *Required*: Subscribe to Postgres changes on `jobs` and `applications` to update the local Zustand cache seamlessly via websockets.
* **Storage**:
  * *Current*: Not used. Generated resumes are strictly Markdown in memory.
  * *Required*: When implementing PDF generation, `supabase.storage` will be required to securely host and serve `resume_exports`.
* **Edge Functions**:
  * *Current*: Not used. All heavy computation (AI prompt generation, fetching) happens in the browser.
  * *Required*: Must be implemented to proxy LLM requests (protecting vendor API keys) and handle secure webhook callbacks (e.g., Stripe subscriptions).

---

## 3. Security Improvements & Deployment

### Security Risks
1. **Client-Side Data Trust**: Because the frontend pushes massive JSON blobs into the database directly (e.g., `knowledge_base jsonb`), the database inherently trusts the client. A malicious user could inject arbitrary data sizes or malformed schemas into their own row, potentially causing performance issues when queried.
2. **Local Storage JWTs**: Storing session tokens in `localStorage` makes them susceptible to XSS attacks.

### Mitigation Roadmap
1. **Database-Level Validation**: Introduce `pg_jsonschema` (a Postgres extension) to validate the structure of incoming JSON blobs at the database level before they are saved.
2. **Migration to SSR Auth**: Migrate from client-side `localStorage` auth to Server-Side Auth using HTTP-only cookies. This prevents JavaScript from reading the session token, neutralizing XSS token theft.

---

## 4. Evolution: Migrating to a Fully Server-Backed SaaS

Octant is currently operating as a "Fat Client" — it downloads the entire database into memory (Zustand) on load, does all processing locally, and backs it up to the cloud.

To scale into a true enterprise SaaS, the architecture must evolve:

### Step 1: Relational Data Fetching (Thin Client)
Instead of fetching a massive `discoveries` JSON blob into memory on boot, the application should query Supabase relationally:
```typescript
// Future implementation
const { data } = await supabase
  .from('discovered_jobs')
  .select('*')
  .eq('status', 'pending')
  .range(0, 50); // Paginated!
```

### Step 2: Edge-Driven AI
Migrate the `src/services/ai/` directory out of the React codebase and into `supabase/functions/ai-proxy/`. The React client will only pass the prompt context; the Edge Function handles the prompt formatting, API key management, rate limiting, and returns the strictly-typed JSON response.

### Step 3: Server-Side Validation via Repositories
Remove raw `.upsert()` calls from Zustand stores. All mutations must go through a Repository pattern that ensures data normalization before interacting with the Supabase client.
