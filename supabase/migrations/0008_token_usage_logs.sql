-- 0008_token_usage_logs.sql
-- Phase 12 — AI budget tracking. The ai-proxy Edge Function records every hosted completion's token
-- usage here (via the service-role key) so we can see who is burning API budget and, in time,
-- rate-limit by Stripe tier. Owners may read their own usage; only the service role writes.

create table if not exists public.token_usage_logs (
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

-- Read-only for owners; NO insert/update/delete policy → only the service-role Edge Function writes.
drop policy if exists "Users can read their own token usage" on public.token_usage_logs;
create policy "Users can read their own token usage"
  on public.token_usage_logs for select using (auth.uid() = user_id);

-- Supports "usage for user X since <date>" (the monthly-budget rollup).
create index if not exists idx_token_usage_user_created on public.token_usage_logs (user_id, created_at);
