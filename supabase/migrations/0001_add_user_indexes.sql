-- 0001_add_user_indexes.sql
-- Phase 1: Database Stabilization — secondary indexes for RLS user-scoping + hot filters.
--
-- Every store query is `.eq('user_id', …)` but jobs / job_analyses / applications have no index
-- on user_id (FK only), forcing sequential scans. This adds the missing secondary indexes.
--
-- CONCURRENTLY note: these tables are currently empty (schema not yet deployed), so a plain
-- CREATE INDEX is safe and runs inside the migration transaction. When re-running against a
-- POPULATED production table, switch to CREATE INDEX CONCURRENTLY and run OUTSIDE a transaction
-- to avoid locking writes.

-- jobs has no `status` column yet; add it so the (user_id, status) index has a target.
-- Nullable text for now — allowed values / NOT NULL+default / population are deferred to the
-- phase that starts writing status from the store (see plan). Tighten with a CHECK/enum then.
alter table public.jobs
  add column if not exists status text;

-- Composite (user_id, <hot filter>) indexes.
-- The leftmost `user_id` prefix still serves the current user_id-only fetches, so these REPLACE
-- the need for standalone user_id indexes on jobs and applications.
create index if not exists idx_jobs_user_id_status
  on public.jobs (user_id, status);

create index if not exists idx_applications_user_id_stage
  on public.applications (user_id, stage);

-- job_analyses is only ever filtered by user_id (no secondary hot column).
create index if not exists idx_job_analyses_user_id
  on public.job_analyses (user_id);
