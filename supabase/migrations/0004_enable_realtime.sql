-- Streams jobs and applications changes to the user's other devices via Supabase Realtime.
-- REPLICA IDENTITY FULL so DELETE events carry user_id; otherwise the user_id realtime filter drops them.

alter table public.jobs replica identity full;
alter table public.applications replica identity full;

do $$
begin
  -- The publication only exists on Supabase; skip on plain Postgres.
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
