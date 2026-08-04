-- 0014_email_infrastructure.sql
-- Phase 15 — transactional email.
--
-- Two tables, both written ONLY by Edge Functions holding the service-role key:
--
--   * email_log         — one row per attempted send. Its job is to answer "did this person get the
--                         email, and if not, why" without opening the Resend dashboard. It is also the
--                         idempotency ledger: `idempotency_key` is UNIQUE, so two concurrent triggers
--                         for the same logical event (a retried Stripe webhook, a double-clicked
--                         button) cannot both send. The key is generated in the app layer by
--                         EmailService.buildIdempotencyKey and matches the key sent to Resend, so the
--                         two systems de-duplicate on the same value.
--
--   * email_preferences — per-user marketing opt-ins plus a stable unsubscribe token. Transactional
--                         mail deliberately IGNORES this table (see the comment on the table): a
--                         password reset or a failed-payment notice is not something a user can turn
--                         off, and treating it as optional would be a security and billing hazard.
--
-- RLS mirrors the posture established in 0007 for `subscriptions`: owners may read, nobody may write
-- from a client. Tiers, and now delivery records, are server-authored facts.

-- ── email_log ─────────────────────────────────────────────────────────────────────────────────────

create table if not exists public.email_log (
  id uuid primary key default uuid_generate_v4(),
  -- Nullable: an invitation goes to someone who has no account yet, and we still want the record.
  user_id uuid references auth.users on delete cascade,
  to_email text not null,
  -- Matches TemplateName in packages/email/src/templates/props.ts. Left as free text rather than an
  -- enum so adding a template is a code change, not a migration; the app layer is the source of truth.
  template text not null,
  subject text not null,
  -- Resend's message id, once it issues one. Null for skipped sends and outright failures.
  provider_message_id text,
  provider text not null default 'resend',
  status text not null default 'queued'
    check (status in ('queued', 'skipped', 'sent', 'delivered', 'bounced', 'complained', 'failed', 'suppressed')),
  -- The stable EmailError.code (e.g. EMAIL_TRANSPORT), never the raw message — branchable in queries.
  error_code text,
  error_message text,
  -- The de-duplication key. UNIQUE is the actual enforcement: an insert that conflicts means the send
  -- already happened, and the caller treats that as success rather than sending again.
  idempotency_key text not null unique,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.email_log enable row level security;

-- Owners may read their own delivery history (useful for a future "resend this email" affordance).
-- There is deliberately NO insert/update/delete policy, so only the service-role key can write.
drop policy if exists "email_log_select_own" on public.email_log;
create policy "email_log_select_own"
  on public.email_log for select using (auth.uid() = user_id);

create index if not exists idx_email_log_user_created
  on public.email_log (user_id, created_at desc);
create index if not exists idx_email_log_template on public.email_log (template);
-- Partial: the only status queries that matter operationally are the failures.
create index if not exists idx_email_log_failures
  on public.email_log (status, created_at desc)
  where status in ('bounced', 'complained', 'failed', 'suppressed');
-- The provider webhook looks rows up by Resend's id to record delivery transitions.
create index if not exists idx_email_log_provider_message
  on public.email_log (provider_message_id)
  where provider_message_id is not null;

comment on table public.email_log is
  'Append-only record of every transactional email attempt. Written only by Edge Functions via the '
  'service-role key. `idempotency_key` is the de-duplication ledger shared with Resend.';

-- ── email_preferences ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.email_preferences (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users on delete cascade not null unique,
  -- Marketing-style opt-ins. Neither is wired to a sender yet; they exist so the first non-
  -- transactional email has somewhere to check before sending, instead of a column being bolted on.
  product_updates boolean not null default false,
  discovery_digest boolean not null default false,
  -- Stable per-user token for one-click preference links in email footers. Random and unguessable, so
  -- it can appear in a URL without exposing the user id.
  unsubscribe_token uuid not null unique default uuid_generate_v4(),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.email_preferences enable row level security;

-- Owners may read and change their own opt-ins. Insert is allowed (the row is created lazily on first
-- visit to settings) but the token can never be chosen by the client — the column default supplies it,
-- and the check below stops a client claiming a specific one.
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

-- ── Helpers ───────────────────────────────────────────────────────────────────────────────────────

-- Resolves the footer token for a user, creating the preferences row on first use. SECURITY DEFINER so
-- the Edge Functions can call it with the service-role key and so a plain user reading their own token
-- doesn't need insert rights on a table they may not have a row in yet.
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

-- Keeps `updated_at` honest on status transitions written by the Resend webhook.
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
