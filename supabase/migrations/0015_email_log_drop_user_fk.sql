-- Drops the email_log.user_id FK: the auth hook writes inside GoTrue's uncommitted signup transaction,
-- so the FK check failed (23503) and rolled back every signup. It also keeps the audit log after user deletion.

alter table public.email_log
  drop constraint if exists email_log_user_id_fkey;

comment on column public.email_log.user_id is
  'Owner of the message, when known. Deliberately NOT a foreign key: the auth Send Email Hook writes this '
  'row from inside GoTrue''s uncommitted signup transaction, where the auth.users row is not yet visible. '
  'Also keeps the audit trail after a user is deleted.';

-- email_preferences keeps its cascading FK: it is written after signup commits and should go with the account.
