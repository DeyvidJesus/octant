# Octant Frontend Architecture

This document breaks down how the React frontend of Octant is structured, how data flows through it, and where the boundaries between presentation and business logic lie.

---

## Component Hierarchy & Layout Structure

Octant follows a strict compositional hierarchy to ensure scalability. At the root, the UI is orchestrated by the `AppLayout` component.

```text
<AppRoutes> (src/app/routes.tsx)
  └── <ProtectedRoute> (Checks session)
       └── <AppLayout> (src/app/AppLayout.tsx)
            ├── <OnboardingModal /> (Global overlays)
            ├── <Sidebar /> (Persistent navigation)
            └── <main> (Scrollable viewport)
                 └── <Outlet /> (Yields to Feature Pages)
```

The layout is designed with CSS Flexbox (`flex h-screen overflow-hidden`) so that the sidebar remains static while the `<main>` area scrolls independently. Notably, it contains specific overrides for printing (`print:h-auto print:overflow-visible`) to allow the resume generator to flow naturally onto A4 pages rather than clipping inside a flex container.

## Routing

Routing is managed by `react-router-dom` in `src/app/routes.tsx`.
It uses a declarative `<Routes>` configuration rather than the newer data-router API. 
* **Public Routes**: `/login` 
* **Protected Routes**: Wrapped in `<ProtectedRoute>`, which suspends rendering until the global `useAuth()` context verifies an active Supabase session.

## Shared Components vs. Feature Components

The frontend strictly divides components into two categories:

### 1. Shared Components (`src/components/ui/`)
These are "dumb", domain-agnostic building blocks.
* **Examples**: `Button.tsx`, `PageHeader.tsx`, `EmptyState.tsx`, `Badge.tsx`.
* **Rules**: They cannot import from `src/modules`, `src/stores`, or `src/services`. They rely entirely on passed `props` and render UI using Tailwind utility classes. They have no concept of a "Job" or a "Resume".

### 2. Feature Components (`src/modules/*/`)
These are "smart", domain-specific pages and widgets.
* **Examples**: `JobBoardPage.tsx`, `MasterResumePage.tsx`, `ProfileCard.tsx`.
* **Rules**: They connect directly to global Zustand stores, handle user events, orchestrate data fetching, and compose Shared Components into actual features.

## Custom Hooks & State Ownership

There is no dedicated `src/hooks/` directory for generic React hooks. Instead, custom hooks are entirely driven by **Zustand** stores (`useResumeStore`, `useJobsStore`, `useApplicationsStore`).

**State Ownership**: 
React does **not** own the domain state. Local `useState` is used exclusively for ephemeral UI state (e.g., `showArchived` toggle, open/close dropdowns, form inputs before submission). The actual domain entities (the user's resume, their saved jobs) are owned entirely by the Zustand stores. 

## Rendering Flow & Composition Patterns

1. **Top-Down Subscription**: Pages (like `MasterResumePage`) subscribe to their required slice of state via a Zustand hook (`const resume = useResumeStore((state) => state.resume)`).
2. **Prop Drilling (Shallow)**: The page passes the required chunk of that state down to specialized child components (e.g., `<ExperienceList experience={resume.experience} />`).
3. **Event Bubbling (Action Passing)**: Instead of children directly mutating the store, pages often pass down an `onChange` callback that wraps the store's mutator function (e.g., `updateResume`).

**Composition Pattern**: The UI makes heavy use of layout wrappers. For example, `CollapsibleSection` handles the open/close state and header UI, while blindly rendering whatever `children` are passed inside. This prevents the accordion logic from leaking into the `ExperienceList` logic.

---

## The Boundary: React vs. Business Logic

Where does React end and the business logic begin?

* **React's Responsibility**: Rendering the DOM, capturing user inputs, managing ephemeral UI state (modals, dropdowns, active tabs), and calling a store action.
* **Business Logic's Responsibility (Zustand/Services)**: Data validation, structuring the JSON payloads, appending timestamps (`nowIso()`), updating the local cache, communicating with Supabase, and dispatching AI requests.

**The Golden Rule in this codebase**: If it requires talking to the database or processing data rules (like calculating an ATS match score), it does not belong in a `.tsx` file.

---

## Technical Debt: Violations of Separation of Concerns

While the architecture is largely clean, there are several components that violate the separation of concerns:

1. **Inline Business/Confirm Logic (`JobBoardPage.tsx`)**:
   Instead of abstracting deletion logic into a handler or a generic confirmation modal service, `JobBoardPage.tsx` directly implements a browser `window.confirm` in the JSX:
   ```tsx
   onClick={() => {
     if (window.confirm(`Delete ${job.company}...`)) {
       removeJob(job.id)
     }
   }}
   ```
   *Issue*: This mixes raw browser APIs and business confirmation logic directly into the presentation layer.

2. **Leaky Derived State (`JobBoardPage.tsx`)**:
   The page manually filters jobs inside the component body:
   ```tsx
   const visibleJobs = jobs.filter((job) => job.archived === showArchived)
   ```
   *Issue*: Derived domain state (filtering active vs. archived jobs) should ideally be encapsulated as a memoized selector within the Zustand store (`useJobsStore(selectVisibleJobs)`), keeping the React component purely focused on rendering the result.

3. **Routing Logic Tangled in Views**:
   Feature components contain hardcoded strings for navigation (`navigate('/jobs/new')`). 
   *Issue*: As the application grows, changing a route path requires a global find-and-replace across multiple feature components instead of utilizing a centralized route dictionary or utility function.
