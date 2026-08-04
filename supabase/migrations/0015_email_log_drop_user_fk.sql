-- 0015_email_log_drop_user_fk.sql
-- Phase 15 fix — remove the foreign key from email_log.user_id to auth.users.
--
-- WHY (this was a real, subtle production failure):
--
-- Supabase Auth calls the Send Email Hook from INSIDE its own uncommitted transaction. During a signup the
-- new `auth.users` row exists only within that transaction, so an Edge Function — which connects over a
-- separate session — cannot see it. The hook's insert into `email_log` therefore failed the foreign key
-- check with 23503, the function returned an error, and GoTrue rolled the whole signup back. Symptom: every
-- signup returned "Unexpected status code returned from hook: 500", `auth.users` stayed empty, and
-- `email_log` had no row explaining it. Probes with no user id worked fine, which made the pipeline look
-- healthy.
--
-- The column stays, and so does its index — knowing which user an email belongs to is still useful. What
-- goes is the referential guarantee, which was never appropriate here for two independent reasons:
--
--   1. Timing: the writer legitimately runs before the referenced row is visible (above).
--   2. Semantics: this is an append-only audit log. The previous `on delete cascade` meant deleting a user
--      also destroyed the record of every security email ever sent to them — exactly the history you want
--      to keep after an account is removed.
--
-- Orphaned ids are acceptable and expected. Nothing joins this table in a way that requires the guarantee;
-- the RLS policy filters on `auth.uid() = user_id`, which is unaffected.

alter table public.email_log
  drop constraint if exists email_log_user_id_fkey;

comment on column public.email_log.user_id is
  'Owner of the message, when known. Deliberately NOT a foreign key: the auth Send Email Hook writes this '
  'row from inside GoTrue''s uncommitted signup transaction, where the auth.users row is not yet visible. '
  'Also keeps the audit trail after a user is deleted.';

-- email_preferences keeps its foreign key and its cascade on purpose: it is written by the app (and by the
-- `email_unsubscribe_token` RPC) well after the user is committed, and per-user opt-ins genuinely should
-- disappear with the account.
