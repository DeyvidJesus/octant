-- 0013_discovery_signals.sql
-- Phase 14 (Discovery redesign, Learning phase): capture the user's reactions to discovered jobs
-- (approved / dismissed / saved / applied / interested) as structured feature rows. A deterministic
-- aggregation turns these into learned preferences that re-rank the feed and bias future search
-- strategies — no extra AI cost.

create table if not exists public.discovery_signals (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users on delete cascade not null,
  action text not null check (action in ('approved', 'dismissed', 'saved', 'applied', 'interested')),
  -- Extracted candidate features: { company, role, technologies[], workMode, salaryRange, seniority, score }.
  features jsonb not null default '{}'::jsonb,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.discovery_signals enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='discovery_signals' and policyname='Users can access their own discovery signals') then
    create policy "Users can access their own discovery signals" on public.discovery_signals for all
      using (auth.uid() = user_id) with check (auth.uid() = user_id);
  end if;
end $$;

create index if not exists idx_discovery_signals_user_created on public.discovery_signals (user_id, created_at desc);
