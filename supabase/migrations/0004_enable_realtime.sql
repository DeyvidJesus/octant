-- 0004_enable_realtime.sql
-- Phase 7: Cross-device synchronization.
--
-- Enables Supabase Realtime for the two collaboratively-edited tables so a change made on one device
-- streams to the same user's other devices with no manual refresh. Two requirements:
--
--   1) REPLICA IDENTITY FULL — so DELETE events carry the FULL old row (including user_id). With the
--      default replica identity a delete's old record contains only the primary key, so the
--      `user_id=eq.<id>` realtime filter can never match a delete and cross-device deletes are
--      silently dropped. (Cost: slightly larger WAL for these low-write tables — an acceptable trade.)
--
--   2) Membership in the `supabase_realtime` publication — so Postgres actually streams the changes.

alter table public.jobs replica identity full;
alter table public.applications replica identity full;

do $$
begin
  -- The publication is created and owned by Supabase. Guard on its existence so this migration is a
  -- harmless no-op on a plain Postgres (e.g. local CI) and idempotent on repeat runs.
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'jobs'
    ) then
      alter publication supabase_realtime add table public.jobs;
    end if;

    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'applications'
    ) then
      alter publication supabase_realtime add table public.applications;
    end if;
  end if;
end $$;
