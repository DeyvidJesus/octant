-- Adds (user_id, <filter>) indexes so user-scoped queries stop seq-scanning.
-- Plain CREATE INDEX is fine on empty tables; use CONCURRENTLY outside a transaction on populated ones.

-- Nullable for now; add a CHECK once the store writes status.
alter table public.jobs
  add column if not exists status text;

-- The leftmost user_id prefix also serves user_id-only lookups, so no standalone index is needed.
create index if not exists idx_jobs_user_id_status
  on public.jobs (user_id, status);

create index if not exists idx_applications_user_id_stage
  on public.applications (user_id, stage);

create index if not exists idx_job_analyses_user_id
  on public.job_analyses (user_id);
