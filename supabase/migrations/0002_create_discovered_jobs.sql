-- One row per discovered job, replacing the per-user discoveries.state blob that was re-uploaded on every triage.

create table if not exists public.discovered_jobs (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users not null,
  url text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  data jsonb not null default '{}'::jsonb,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.discovered_jobs enable row level security;

-- CREATE POLICY has no IF NOT EXISTS, so drop first to stay idempotent.
drop policy if exists "Users can only access their own discovered jobs" on public.discovered_jobs;
create policy "Users can only access their own discovered jobs"
  on public.discovered_jobs for all using (auth.uid() = user_id);

-- Serves the paginated pending queue (ORDER BY created_at DESC) straight from the index.
create index if not exists idx_discovered_jobs_user_status_created
  on public.discovered_jobs (user_id, status, created_at);
