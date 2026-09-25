-- Per-completion token usage, written by the ai-proxy Edge Function with the service-role key.

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

-- Owners can read; no write policies.
drop policy if exists "Users can read their own token usage" on public.token_usage_logs;
create policy "Users can read their own token usage"
  on public.token_usage_logs for select using (auth.uid() = user_id);

create index if not exists idx_token_usage_user_created on public.token_usage_logs (user_id, created_at);
