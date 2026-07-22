-- 0010_user_id_fk_cascade.sql
-- Phase 13: account deletion hygiene.
--
-- Every `user_id` column references auth.users with NO on-delete action, so deleting an auth user
-- fails on the FK (or, if forced, orphans rows). This migration recreates each user_id FK with
-- ON DELETE CASCADE so removing a user cleanly removes all of their data.
--
-- Idempotent: it discovers the actual constraint name per table (never assumes a default) and
-- re-applies cascade on repeat runs.

do $$
declare
  t text;
  fk_name text;
  owned_tables text[] := array[
    'jobs', 'job_analyses', 'applications', 'settings', 'resumes', 'tailored_resumes',
    'discoveries', 'discovered_jobs', 'resume_organizations', 'resume_roles', 'resume_skills',
    'resume_facts', 'user_skills', 'mock_interviews', 'mock_answers', 'subscriptions',
    'token_usage_logs'
  ];
begin
  foreach t in array owned_tables loop
    -- Skip tables that don't exist yet (defensive on partial schemas).
    if to_regclass('public.' || t) is null then
      continue;
    end if;

    select tc.constraint_name into fk_name
    from information_schema.table_constraints tc
    join information_schema.key_column_usage kcu
      on tc.constraint_name = kcu.constraint_name and tc.table_schema = kcu.table_schema
    where tc.table_schema = 'public'
      and tc.table_name = t
      and tc.constraint_type = 'FOREIGN KEY'
      and kcu.column_name = 'user_id'
    limit 1;

    if fk_name is not null then
      execute format('alter table public.%I drop constraint %I', t, fk_name);
    end if;
    execute format(
      'alter table public.%I add constraint %I foreign key (user_id) references auth.users(id) on delete cascade',
      t, t || '_user_id_fkey'
    );
  end loop;
end $$;
