-- ─────────────────────────────────────────────────────────────────────────────
-- Security fix — `email_unsubscribe_token(uid)` must not be callable by clients.
--
-- The function is SECURITY DEFINER and takes an arbitrary `uid`. Postgres grants EXECUTE on new
-- functions to PUBLIC, and Supabase's default privileges also grant it to `anon` and `authenticated`,
-- so any signed-in user could call it through PostgREST (`supabase.rpc(...)`) with ANOTHER user's id
-- and read (or mint) that user's unsubscribe token, which is the capability behind their email
-- preferences link.
--
-- Only the Edge Functions need it (`_shared/mailer.ts → preferencesUrlFor`), and they call it with the
-- service-role key. So: revoke from everyone, grant back to `service_role` only.
--
-- The plan helpers from 0007 (`is_pro`, `within_job_limit`, `within_tailored_resume_limit`) are left
-- executable on purpose: RLS policies call them as the requesting role, so revoking would break every
-- capped insert. They only disclose a boolean about the plan.
--
-- Idempotent: safe to re-run.
-- ─────────────────────────────────────────────────────────────────────────────

revoke execute on function public.email_unsubscribe_token(uuid) from public, anon, authenticated;
grant execute on function public.email_unsubscribe_token(uuid) to service_role;
