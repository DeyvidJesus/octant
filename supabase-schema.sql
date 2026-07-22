-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Table: jobs
-- Hybrid blob design: a strongly-typed (id, user_id) envelope with the full JobOpportunity domain
-- object in the `data` jsonb column. This matches the repository layer (JobRepository) and the
-- normalized tables (tailored_resumes, discovered_jobs, resume_*). Realtime streams `data` directly.
create table public.jobs (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users not null,
  data jsonb not null default '{}'::jsonb,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Table: job_analyses — one ATS analysis per (user, job); `data` holds the JobAnalysis domain object.
create table public.job_analyses (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users not null,
  job_id uuid references public.jobs on delete cascade not null,
  match_score integer not null default 0,
  data jsonb not null default '{}'::jsonb,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Table: applications — the Application domain object (incl. denormalized company/role and the
-- event timeline) lives in `data`; no hard FK to jobs so an application survives job deletion.
create table public.applications (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users not null,
  data jsonb not null default '{}'::jsonb,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Table: settings
create table public.settings (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users not null unique,
  theme text default 'system',
  preferences jsonb default '{}'::jsonb
);

-- Row Level Security
alter table public.jobs enable row level security;
alter table public.job_analyses enable row level security;
alter table public.applications enable row level security;
alter table public.settings enable row level security;

create policy "Users can only access their own jobs" on public.jobs for all using (auth.uid() = user_id);
create policy "Users can only access their own job analyses" on public.job_analyses for all using (auth.uid() = user_id);
create policy "Users can only access their own applications" on public.applications for all using (auth.uid() = user_id);
create policy "Users can only access their own settings" on public.settings for all using (auth.uid() = user_id);

-- One analysis per (user, job): lets upsert(onConflict user_id,job_id) replace instead of duplicating.
create unique index if not exists uq_job_analyses_user_job on public.job_analyses (user_id, job_id);
create index if not exists idx_jobs_user_id on public.jobs (user_id);
create index if not exists idx_applications_user_id on public.applications (user_id);
create index if not exists idx_job_analyses_user_id on public.job_analyses (user_id);

-- Table: resumes
create table public.resumes (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users not null unique,
  knowledge_base jsonb not null default '{}'::jsonb
);

-- Table: tailored_resumes (normalized; one row per (user, job) — Phase 11 prerequisite)
create table public.tailored_resumes (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users not null,
  job_id uuid references public.jobs (id) on delete cascade not null,
  data jsonb not null default '{}'::jsonb,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique (user_id, job_id)
);

-- Table: discoveries
create table public.discoveries (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users not null unique,
  state jsonb not null default '{}'::jsonb
);

alter table public.resumes enable row level security;
alter table public.tailored_resumes enable row level security;
alter table public.discoveries enable row level security;

create policy "Users can only access their own resumes" on public.resumes for all using (auth.uid() = user_id);
create policy "Users can only access their own tailored resumes" on public.tailored_resumes for all using (auth.uid() = user_id);
create policy "Users can only access their own discoveries" on public.discoveries for all using (auth.uid() = user_id);
create index if not exists idx_tailored_resumes_user_id on public.tailored_resumes (user_id);
create index if not exists idx_tailored_resumes_job_id on public.tailored_resumes (job_id);

-- Table: discovered_jobs (relational review queue; one row per discovered candidate). `score` is the
-- top-level ranking column; the full DiscoveredCandidate (incl. its JobAnalysis) lives in `data`.
create table public.discovered_jobs (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users not null,
  url text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  score integer,
  data jsonb not null default '{}'::jsonb,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.discovered_jobs enable row level security;

create policy "Users can only access their own discovered jobs" on public.discovered_jobs for all using (auth.uid() = user_id);

create index if not exists idx_discovered_jobs_user_status_created on public.discovered_jobs (user_id, status, created_at);
create index if not exists idx_discovered_jobs_user_status_score on public.discovered_jobs (user_id, status, score desc);

-- Knowledge-base normalization (Phase 5). The four structural/high-churn collections become rows;
-- the remaining collections stay in resumes.knowledge_base as a slim residual document.
create table public.resume_organizations (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users not null,
  data jsonb not null default '{}'::jsonb
);

create table public.resume_roles (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users not null,
  organization_id uuid references public.resume_organizations (id) on delete set null,
  data jsonb not null default '{}'::jsonb
);

create table public.resume_skills (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users not null,
  data jsonb not null default '{}'::jsonb
);

create table public.resume_facts (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users not null,
  data jsonb not null default '{}'::jsonb
);

alter table public.resume_organizations enable row level security;
alter table public.resume_roles enable row level security;
alter table public.resume_skills enable row level security;
alter table public.resume_facts enable row level security;

create policy "Users can only access their own resume organizations" on public.resume_organizations for all using (auth.uid() = user_id);
create policy "Users can only access their own resume roles" on public.resume_roles for all using (auth.uid() = user_id);
create policy "Users can only access their own resume skills" on public.resume_skills for all using (auth.uid() = user_id);
create policy "Users can only access their own resume facts" on public.resume_facts for all using (auth.uid() = user_id);

create index if not exists idx_resume_organizations_user_id on public.resume_organizations (user_id);
create index if not exists idx_resume_roles_user_id on public.resume_roles (user_id);
create index if not exists idx_resume_skills_user_id on public.resume_skills (user_id);
create index if not exists idx_resume_facts_user_id on public.resume_facts (user_id);
create index if not exists idx_resume_roles_organization_id on public.resume_roles (organization_id);

-- Realtime cross-device sync (Phase 7). FULL replica identity lets the user_id filter match DELETE
-- events; publication membership makes Postgres stream the changes.
alter table public.jobs replica identity full;
alter table public.applications replica identity full;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'jobs') then
      alter publication supabase_realtime add table public.jobs;
    end if;
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'applications') then
      alter publication supabase_realtime add table public.applications;
    end if;
  end if;
end $$;

-- Interview simulation (Phase 10). AI-scored skill mastery + mock interview sessions/answers,
-- replacing the retired interview_preps self-rating blob.
create table public.user_skills (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users not null,
  skill text not null,
  category text not null default 'technical',
  mastery integer not null default 0 check (mastery between 0 and 100),
  attempts integer not null default 0,
  last_scored_at timestamp with time zone,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique (user_id, skill)
);

create table public.mock_interviews (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users not null,
  job_id uuid references public.jobs on delete set null,
  company text,
  role text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table public.mock_answers (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users not null,
  mock_interview_id uuid references public.mock_interviews on delete cascade not null,
  skill text,
  question text not null,
  answer text not null,
  score integer not null check (score between 0 and 100),
  feedback jsonb not null default '{}'::jsonb,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.user_skills enable row level security;
alter table public.mock_interviews enable row level security;
alter table public.mock_answers enable row level security;

create policy "Users can only access their own user skills" on public.user_skills for all using (auth.uid() = user_id);
create policy "Users can only access their own mock interviews" on public.mock_interviews for all using (auth.uid() = user_id);
create policy "Users can only access their own mock answers" on public.mock_answers for all using (auth.uid() = user_id);

create index if not exists idx_user_skills_user_id on public.user_skills (user_id);
create index if not exists idx_mock_interviews_user_id on public.mock_interviews (user_id);
create index if not exists idx_mock_answers_user_id on public.mock_answers (user_id);
create index if not exists idx_mock_answers_interview on public.mock_answers (mock_interview_id);

-- Monetization & role-based access control (Phase 11).
-- subscriptions records tier; RLS caps free-tier creation (3 jobs, 1 tailored resume), pro unlimited.
create table public.subscriptions (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users not null unique,
  tier text not null default 'free' check (tier in ('free', 'pro')),
  status text,
  stripe_customer_id text,
  stripe_subscription_id text,
  current_period_end timestamp with time zone,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.subscriptions enable row level security;
create policy "Users can read their own subscription" on public.subscriptions for select using (auth.uid() = user_id);
create index if not exists idx_subscriptions_user_id on public.subscriptions (user_id);
create index if not exists idx_subscriptions_stripe_customer on public.subscriptions (stripe_customer_id);

create or replace function public.is_pro(uid uuid)
  returns boolean language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.subscriptions where user_id = uid and tier = 'pro'); $$;

create or replace function public.within_job_limit(new_id uuid, uid uuid)
  returns boolean language sql stable security definer set search_path = public
as $$ select public.is_pro(uid) or (select count(*) from public.jobs where user_id = uid and id <> new_id) < 3; $$;

create or replace function public.within_tailored_resume_limit(new_job_id uuid, uid uuid)
  returns boolean language sql stable security definer set search_path = public
as $$ select public.is_pro(uid) or (select count(*) from public.tailored_resumes where user_id = uid and job_id <> new_job_id) < 1; $$;

-- Replace broad ownership policies with per-command policies whose INSERT enforces the free-tier cap.
drop policy if exists "Users can only access their own jobs" on public.jobs;
create policy "jobs_select" on public.jobs for select using (auth.uid() = user_id);
create policy "jobs_update" on public.jobs for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "jobs_delete" on public.jobs for delete using (auth.uid() = user_id);
create policy "jobs_insert" on public.jobs for insert with check (auth.uid() = user_id and public.within_job_limit(id, auth.uid()));

drop policy if exists "Users can only access their own tailored resumes" on public.tailored_resumes;
create policy "tailored_select" on public.tailored_resumes for select using (auth.uid() = user_id);
create policy "tailored_update" on public.tailored_resumes for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "tailored_delete" on public.tailored_resumes for delete using (auth.uid() = user_id);
create policy "tailored_insert" on public.tailored_resumes for insert with check (auth.uid() = user_id and public.within_tailored_resume_limit(job_id, auth.uid()));

-- AI budget tracking (Phase 12). ai-proxy logs token usage here (service-role writes); owners read.
create table public.token_usage_logs (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users not null,
  provider text not null,
  model text not null,
  prompt_tokens integer not null default 0,
  completion_tokens integer not null default 0,
  total_tokens integer not null default 0,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.token_usage_logs enable row level security;
create policy "Users can read their own token usage" on public.token_usage_logs for select using (auth.uid() = user_id);
create index if not exists idx_token_usage_user_created on public.token_usage_logs (user_id, created_at);

-- Account deletion hygiene (Phase 13): every user_id FK cascades so deleting an auth user removes
-- all of their rows instead of failing on the constraint. Discovers each FK by name (idempotent).
do $$
declare
  t text;
  fk_name text;
  owned_tables text[] := array[
    'jobs', 'job_analyses', 'applications', 'settings', 'resumes', 'tailored_resumes',
    'discoveries', 'discovered_jobs', 'resume_organizations', 'resume_roles', 'resume_skills',
    'resume_facts', 'user_skills', 'mock_interviews', 'mock_answers', 'subscriptions',
    'token_usage_logs'
  ];
begin
  foreach t in array owned_tables loop
    if to_regclass('public.' || t) is null then
      continue;
    end if;
    select tc.constraint_name into fk_name
    from information_schema.table_constraints tc
    join information_schema.key_column_usage kcu
      on tc.constraint_name = kcu.constraint_name and tc.table_schema = kcu.table_schema
    where tc.table_schema = 'public' and tc.table_name = t
      and tc.constraint_type = 'FOREIGN KEY' and kcu.column_name = 'user_id'
    limit 1;
    if fk_name is not null then
      execute format('alter table public.%I drop constraint %I', t, fk_name);
    end if;
    execute format(
      'alter table public.%I add constraint %I foreign key (user_id) references auth.users(id) on delete cascade',
      t, t || '_user_id_fkey'
    );
  end loop;
end $$;

-- Continuous discovery pipeline (Phase 14). Structured search profile + per-run status log; the
-- discovered_jobs feed streams to the client via realtime.
create table public.search_profiles (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users on delete cascade not null unique,
  data jsonb not null default '{}'::jsonb,
  -- Projected Master Resume snapshot so the offline worker can score without assembling the KB.
  scoring_snapshot jsonb,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table public.discovery_runs (
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

alter table public.search_profiles enable row level security;
alter table public.discovery_runs enable row level security;

create policy "Users can only access their own search profile" on public.search_profiles for all using (auth.uid() = user_id);
-- Owners read + write their own in-session runs; the offline worker writes via the service-role.
create policy "Users can access their own discovery runs" on public.discovery_runs for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index if not exists idx_discovery_runs_user_created on public.discovery_runs (user_id, created_at desc);

-- Learning signals (Phase 14): the user's reactions to discovered jobs, aggregated into learned
-- preferences that re-rank the feed and bias future strategies.
create table public.discovery_signals (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users on delete cascade not null,
  action text not null check (action in ('approved', 'dismissed', 'saved', 'applied', 'interested')),
  features jsonb not null default '{}'::jsonb,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);
alter table public.discovery_signals enable row level security;
create policy "Users can access their own discovery signals" on public.discovery_signals for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create index if not exists idx_discovery_signals_user_created on public.discovery_signals (user_id, created_at desc);

-- Realtime for the discovery feed + run status (FULL replica identity for DELETE user_id filtering).
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
