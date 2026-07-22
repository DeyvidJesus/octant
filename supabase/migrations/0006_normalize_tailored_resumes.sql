-- 0006_normalize_tailored_resumes.sql
-- Phase 11 (prerequisite) — normalize the `generators` JSONB blob into one row per tailored resume.
--
-- Tailored resumes previously lived in `generators.state` (a per-user Record<jobId, TailoredResume>).
-- Row-level plan limits (migration 0007) require one row per tailored resume so RLS can count them,
-- so we relocate them into `tailored_resumes` (one row per (user, job)) and drop the blob table.

create table if not exists public.tailored_resumes (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users not null,
  job_id uuid references public.jobs (id) on delete cascade not null,
  data jsonb not null default '{}'::jsonb,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  -- One tailored resume per job per user; upserts target this key.
  unique (user_id, job_id)
);

alter table public.tailored_resumes enable row level security;

-- Base ownership policy. Migration 0007 replaces this with capped, per-command policies.
drop policy if exists "Users can only access their own tailored resumes" on public.tailored_resumes;
create policy "Users can only access their own tailored resumes"
  on public.tailored_resumes for all using (auth.uid() = user_id);

create index if not exists idx_tailored_resumes_user_id on public.tailored_resumes (user_id);
create index if not exists idx_tailored_resumes_job_id on public.tailored_resumes (job_id);

-- The blob table is fully superseded.
drop table if exists public.generators;
