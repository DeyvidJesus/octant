-- 0002_create_discovered_jobs.sql
-- Phase 4: Relational normalization for job discovery.
--
-- Replaces the single per-user `discoveries.state` JSONB blob — which re-uploaded thousands of
-- candidates on every approve/dismiss — with one row per scraped candidate. Triage actions become
-- targeted INSERT/UPDATE statements instead of a full-array upload. `discoveries` is retained only
-- for small, bounded review metadata (dedupe keys, last-sweep timestamp, pending Deep Research id).

create table if not exists public.discovered_jobs (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users not null,
  url text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  data jsonb not null default '{}'::jsonb,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.discovered_jobs enable row level security;

-- CREATE POLICY has no IF NOT EXISTS; drop-then-create keeps this migration idempotent and safe
-- to run standalone or after the baseline schema (which also declares this table + policy).
drop policy if exists "Users can only access their own discovered jobs" on public.discovered_jobs;
create policy "Users can only access their own discovered jobs"
  on public.discovered_jobs for all using (auth.uid() = user_id);

-- The review queue reads WHERE user_id = ? AND status = 'pending' ORDER BY created_at DESC with
-- .range() pagination. (user_id, status, created_at) lets Postgres return each page directly from
-- the index (backward scan for DESC) with no separate sort. The leftmost prefixes also serve
-- user_id-only and (user_id, status) scans (see Phase 1).
create index if not exists idx_discovered_jobs_user_status_created
  on public.discovered_jobs (user_id, status, created_at);
