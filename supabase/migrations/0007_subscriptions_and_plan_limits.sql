-- 0007_subscriptions_and_plan_limits.sql
-- Phase 11 — monetization + role-based access control.
--
-- A `subscriptions` row records each user's tier. RLS then enforces free-tier CREATION caps
-- (max 3 jobs, max 1 tailored resume); pro is unlimited. Subscriptions are written ONLY by the
-- Stripe webhook via the service-role key (which bypasses RLS); clients may read their own row.

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

-- Read-only for owners; NO insert/update/delete policy → clients can never set their own tier.
drop policy if exists "Users can read their own subscription" on public.subscriptions;
create policy "Users can read their own subscription"
  on public.subscriptions for select using (auth.uid() = user_id);

create index if not exists idx_subscriptions_user_id on public.subscriptions (user_id);
create index if not exists idx_subscriptions_stripe_customer on public.subscriptions (stripe_customer_id);

-- Pro check. SECURITY DEFINER so the count reads bypass RLS (no recursion through policies) and a
-- user with no subscription row is simply treated as free.
create or replace function public.is_pro(uid uuid)
  returns boolean language sql stable security definer set search_path = public
as $$
  select exists (select 1 from public.subscriptions where user_id = uid and tier = 'pro');
$$;

-- Jobs cap. `jobs` is upserted by its stable primary key `id`, so we exclude the row being written
-- by id: a genuine new job counts all existing (capped at 3); re-saving an existing job excludes
-- itself and is never blocked.
create or replace function public.within_job_limit(new_id uuid, uid uuid)
  returns boolean language sql stable security definer set search_path = public
as $$
  select public.is_pro(uid)
    or (select count(*) from public.jobs where user_id = uid and id <> new_id) < 3;
$$;

-- Tailored-resume cap. `tailored_resumes` is upserted on the natural key (user_id, job_id) WITHOUT a
-- client-supplied id, so we exclude by job_id instead: re-generating/editing an existing job's
-- resume is never blocked; a second DISTINCT job's resume is blocked for free users.
create or replace function public.within_tailored_resume_limit(new_job_id uuid, uid uuid)
  returns boolean language sql stable security definer set search_path = public
as $$
  select public.is_pro(uid)
    or (select count(*) from public.tailored_resumes where user_id = uid and job_id <> new_job_id) < 1;
$$;

-- Replace the single "for all" jobs policy with per-command policies; INSERT enforces the cap.
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

-- Same treatment for tailored_resumes (replaces the base policy from migration 0006).
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
