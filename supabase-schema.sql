-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Table: jobs
create table public.jobs (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users not null,
  company text not null,
  role text not null,
  description text not null,
  url text,
  category text,
  salary_range text,
  location text,
  work_mode text not null,
  tags text[] default '{}',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  archived boolean default false,
  source text not null,
  status text
);

-- Table: job_analyses
create table public.job_analyses (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users not null,
  job_id uuid references public.jobs on delete cascade not null,
  match_score integer not null,
  analysis_json jsonb not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Table: applications
create table public.applications (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users not null,
  job_id uuid references public.jobs on delete set null,
  company text not null,
  role text not null,
  salary text,
  location text,
  work_mode text not null,
  stage text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  applied_at timestamp with time zone,
  updated_at timestamp with time zone not null,
  notes text,
  feedback text,
  rejection_reason text,
  follow_up_at timestamp with time zone,
  match_score integer,
  priority boolean default false,
  recruiter jsonb,
  links jsonb default '[]'::jsonb,
  events jsonb default '[]'::jsonb
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

-- Table: resumes
create table public.resumes (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users not null unique,
  knowledge_base jsonb not null default '{}'::jsonb
);

-- Table: generators
create table public.generators (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users not null unique,
  state jsonb not null default '{}'::jsonb
);

-- Table: discoveries
create table public.discoveries (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users not null unique,
  state jsonb not null default '{}'::jsonb
);

alter table public.resumes enable row level security;
alter table public.generators enable row level security;
alter table public.discoveries enable row level security;

create policy "Users can only access their own resumes" on public.resumes for all using (auth.uid() = user_id);
create policy "Users can only access their own generators" on public.generators for all using (auth.uid() = user_id);
create policy "Users can only access their own discoveries" on public.discoveries for all using (auth.uid() = user_id);

-- Table: discovered_jobs (Phase 4 — relational review queue; one row per scraped candidate)
create table public.discovered_jobs (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users not null,
  url text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  data jsonb not null default '{}'::jsonb,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.discovered_jobs enable row level security;

create policy "Users can only access their own discovered jobs" on public.discovered_jobs for all using (auth.uid() = user_id);

create index if not exists idx_discovered_jobs_user_status_created on public.discovered_jobs (user_id, status, created_at);

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
