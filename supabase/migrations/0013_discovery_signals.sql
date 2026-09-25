-- User reactions to discovered jobs, stored as feature rows.
-- Aggregated deterministically into preferences that re-rank the feed and steer future searches.

create table if not exists public.discovery_signals (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users on delete cascade not null,
  action text not null check (action in ('approved', 'dismissed', 'saved', 'applied', 'interested')),
  -- { company, role, technologies[], workMode, salaryRange, seniority, score }
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
