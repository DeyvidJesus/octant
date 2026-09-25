-- Adds subscriptions and RLS creation caps for the free tier (3 jobs, 1 tailored resume).
-- Only the Stripe webhook writes subscriptions, via the service-role key.

create table if not exists public.subscriptions (
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

-- No write policies, so clients can never set their own tier.
drop policy if exists "Users can read their own subscription" on public.subscriptions;
create policy "Users can read their own subscription"
  on public.subscriptions for select using (auth.uid() = user_id);

create index if not exists idx_subscriptions_user_id on public.subscriptions (user_id);
create index if not exists idx_subscriptions_stripe_customer on public.subscriptions (stripe_customer_id);

-- SECURITY DEFINER so the lookup skips RLS (no policy recursion); no row means free.
create or replace function public.is_pro(uid uuid)
  returns boolean language sql stable security definer set search_path = public
as $$
  select exists (select 1 from public.subscriptions where user_id = uid and tier = 'pro');
$$;

-- INSERT WITH CHECK runs on upsert too, so the count excludes the row itself by id.
create or replace function public.within_job_limit(new_id uuid, uid uuid)
  returns boolean language sql stable security definer set search_path = public
as $$
  select public.is_pro(uid)
    or (select count(*) from public.jobs where user_id = uid and id <> new_id) < 3;
$$;

-- Upserts use (user_id, job_id) without a client id, so exclude by job_id instead.
create or replace function public.within_tailored_resume_limit(new_job_id uuid, uid uuid)
  returns boolean language sql stable security definer set search_path = public
as $$
  select public.is_pro(uid)
    or (select count(*) from public.tailored_resumes where user_id = uid and job_id <> new_job_id) < 1;
$$;

-- Per-command policies so only INSERT enforces the cap.
drop policy if exists "Users can only access their own jobs" on public.jobs;
drop policy if exists "jobs_select" on public.jobs;
drop policy if exists "jobs_update" on public.jobs;
drop policy if exists "jobs_delete" on public.jobs;
drop policy if exists "jobs_insert" on public.jobs;
create policy "jobs_select" on public.jobs for select using (auth.uid() = user_id);
create policy "jobs_update" on public.jobs for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "jobs_delete" on public.jobs for delete using (auth.uid() = user_id);
create policy "jobs_insert" on public.jobs for insert
  with check (auth.uid() = user_id and public.within_job_limit(id, auth.uid()));

drop policy if exists "Users can only access their own tailored resumes" on public.tailored_resumes;
drop policy if exists "tailored_select" on public.tailored_resumes;
drop policy if exists "tailored_update" on public.tailored_resumes;
drop policy if exists "tailored_delete" on public.tailored_resumes;
drop policy if exists "tailored_insert" on public.tailored_resumes;
create policy "tailored_select" on public.tailored_resumes for select using (auth.uid() = user_id);
create policy "tailored_update" on public.tailored_resumes for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "tailored_delete" on public.tailored_resumes for delete using (auth.uid() = user_id);
create policy "tailored_insert" on public.tailored_resumes for insert
  with check (auth.uid() = user_id and public.within_tailored_resume_limit(job_id, auth.uid()));
