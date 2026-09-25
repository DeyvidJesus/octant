-- Moves tailored resumes from the generators blob to one row per (user, job).
-- Needed so the plan-limit policies in 0007 can count them.

create table if not exists public.tailored_resumes (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users not null,
  job_id uuid references public.jobs (id) on delete cascade not null,
  data jsonb not null default '{}'::jsonb,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  -- Upsert target.
  unique (user_id, job_id)
);

alter table public.tailored_resumes enable row level security;

-- Replaced by per-command capped policies in 0007.
drop policy if exists "Users can only access their own tailored resumes" on public.tailored_resumes;
create policy "Users can only access their own tailored resumes"
  on public.tailored_resumes for all using (auth.uid() = user_id);

create index if not exists idx_tailored_resumes_user_id on public.tailored_resumes (user_id);
create index if not exists idx_tailored_resumes_job_id on public.tailored_resumes (job_id);

drop table if exists public.generators;
