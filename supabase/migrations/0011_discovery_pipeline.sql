-- Discovery pipeline: search_profiles, discovery_runs (one per execution), a discovered_jobs.score column,
-- and realtime on both so the feed streams candidates as the worker writes them.

create table if not exists public.search_profiles (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users on delete cascade not null unique,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);
alter table public.search_profiles enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='search_profiles' and policyname='Users can only access their own search profile') then
    create policy "Users can only access their own search profile" on public.search_profiles for all using (auth.uid() = user_id);
  end if;
end $$;

create table if not exists public.discovery_runs (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users on delete cascade not null,
  status text not null default 'queued' check (status in ('queued', 'running', 'succeeded', 'partial', 'failed')),
  trigger text not null default 'manual' check (trigger in ('manual', 'session', 'scheduled')),
  stats jsonb not null default '{}'::jsonb,
  tokens_used integer not null default 0,
  error text,
  started_at timestamp with time zone,
  finished_at timestamp with time zone,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);
alter table public.discovery_runs enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='discovery_runs' and policyname='Users can access their own discovery runs') then
    -- Owners write in-session runs; the offline worker uses the service role.
    create policy "Users can access their own discovery runs" on public.discovery_runs for all
      using (auth.uid() = user_id) with check (auth.uid() = user_id);
  end if;
end $$;
create index if not exists idx_discovery_runs_user_created on public.discovery_runs (user_id, created_at desc);

alter table public.discovered_jobs add column if not exists score integer;
create index if not exists idx_discovered_jobs_user_status_score on public.discovered_jobs (user_id, status, score desc);

-- FULL so DELETE events carry user_id for the realtime filter (see 0004).
alter table public.discovered_jobs replica identity full;
alter table public.discovery_runs replica identity full;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='discovered_jobs') then
      alter publication supabase_realtime add table public.discovered_jobs;
    end if;
    if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='discovery_runs') then
      alter publication supabase_realtime add table public.discovery_runs;
    end if;
  end if;
end $$;
