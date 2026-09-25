-- Replaces the interview_preps self-rating blob with AI-scored tables: user_skills, mock_interviews, mock_answers.

create table if not exists public.user_skills (
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

create table if not exists public.mock_interviews (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users not null,
  job_id uuid references public.jobs on delete set null,
  company text,
  role text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table if not exists public.mock_answers (
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

drop policy if exists "Users can only access their own user skills" on public.user_skills;
create policy "Users can only access their own user skills" on public.user_skills for all using (auth.uid() = user_id);

drop policy if exists "Users can only access their own mock interviews" on public.mock_interviews;
create policy "Users can only access their own mock interviews" on public.mock_interviews for all using (auth.uid() = user_id);

drop policy if exists "Users can only access their own mock answers" on public.mock_answers;
create policy "Users can only access their own mock answers" on public.mock_answers for all using (auth.uid() = user_id);

create index if not exists idx_user_skills_user_id on public.user_skills (user_id);
create index if not exists idx_mock_interviews_user_id on public.mock_interviews (user_id);
create index if not exists idx_mock_answers_user_id on public.mock_answers (user_id);
create index if not exists idx_mock_answers_interview on public.mock_answers (mock_interview_id);

drop table if exists public.interview_preps cascade;
