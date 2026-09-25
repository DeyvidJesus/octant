-- Transactional email: email_log (one row per send, also the idempotency ledger) and email_preferences.
-- Edge Functions write both with the service-role key; transactional mail ignores preferences.

create table if not exists public.email_log (
  id uuid primary key default uuid_generate_v4(),
  -- Nullable: invitations go to people without an account.
  user_id uuid references auth.users on delete cascade,
  to_email text not null,
  -- TemplateName from packages/email; free text so a new template needs no migration.
  template text not null,
  subject text not null,
  -- Null for skipped and failed sends.
  provider_message_id text,
  provider text not null default 'resend',
  status text not null default 'queued'
    check (status in ('queued', 'skipped', 'sent', 'delivered', 'bounced', 'complained', 'failed', 'suppressed')),
  -- Stable EmailError.code, e.g. EMAIL_TRANSPORT.
  error_code text,
  error_message text,
  -- Same key sent to Resend; a conflicting insert means the email was already sent.
  idempotency_key text not null unique,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.email_log enable row level security;

-- Owners can read; no write policies, so only the service role writes.
drop policy if exists "email_log_select_own" on public.email_log;
create policy "email_log_select_own"
  on public.email_log for select using (auth.uid() = user_id);

create index if not exists idx_email_log_user_created
  on public.email_log (user_id, created_at desc);
create index if not exists idx_email_log_template on public.email_log (template);
-- Partial: only failures are queried by status.
create index if not exists idx_email_log_failures
  on public.email_log (status, created_at desc)
  where status in ('bounced', 'complained', 'failed', 'suppressed');
-- The Resend webhook looks rows up by message id.
create index if not exists idx_email_log_provider_message
  on public.email_log (provider_message_id)
  where provider_message_id is not null;

comment on table public.email_log is
  'Append-only record of every transactional email attempt. Written only by Edge Functions via the '
  'service-role key. `idempotency_key` is the de-duplication ledger shared with Resend.';

create table if not exists public.email_preferences (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users on delete cascade not null unique,
  -- Marketing opt-ins; no sender uses them yet.
  product_updates boolean not null default false,
  discovery_digest boolean not null default false,
  -- Random token for footer preference links, so URLs never expose the user id.
  unsubscribe_token uuid not null unique default uuid_generate_v4(),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.email_preferences enable row level security;

-- Owners can read and edit their opt-ins; insert is allowed because the row is created lazily from settings.
drop policy if exists "email_preferences_select_own" on public.email_preferences;
create policy "email_preferences_select_own"
  on public.email_preferences for select using (auth.uid() = user_id);

drop policy if exists "email_preferences_insert_own" on public.email_preferences;
create policy "email_preferences_insert_own"
  on public.email_preferences for insert with check (auth.uid() = user_id);

drop policy if exists "email_preferences_update_own" on public.email_preferences;
create policy "email_preferences_update_own"
  on public.email_preferences for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists idx_email_preferences_user_id on public.email_preferences (user_id);

comment on table public.email_preferences is
  'Per-user opt-ins for NON-transactional email, plus a stable unsubscribe token. Transactional mail '
  '(auth, security, billing) ignores this table by design — those messages are not optional.';

-- Returns the user's footer token, creating the preferences row on first use.
create or replace function public.email_unsubscribe_token(uid uuid)
  returns uuid language plpgsql security definer set search_path = public
as $$
declare
  token uuid;
begin
  insert into public.email_preferences (user_id)
    values (uid)
    on conflict (user_id) do nothing;
  select unsubscribe_token into token from public.email_preferences where user_id = uid;
  return token;
end;
$$;

-- Bumps updated_at on every update, e.g. Resend webhook status changes.
create or replace function public.touch_updated_at()
  returns trigger language plpgsql
as $$
begin
  new.updated_at := timezone('utc'::text, now());
  return new;
end;
$$;

drop trigger if exists trg_email_log_touch on public.email_log;
create trigger trg_email_log_touch
  before update on public.email_log
  for each row execute function public.touch_updated_at();

drop trigger if exists trg_email_preferences_touch on public.email_preferences;
create trigger trg_email_preferences_touch
  before update on public.email_preferences
  for each row execute function public.touch_updated_at();
