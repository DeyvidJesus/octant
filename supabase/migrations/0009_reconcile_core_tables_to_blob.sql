-- 0009_reconcile_core_tables_to_blob.sql
-- Phase 13: schema/runtime reconciliation.
--
-- JobRepository / ApplicationRepository persist each domain object in a single `data` jsonb column
-- ({id, user_id, data}) — the same hybrid shape as tailored_resumes / discovered_jobs / resume_*.
-- The three original tables (jobs, applications, job_analyses) were never converted and still had
-- typed, NOT NULL columns (company, role, analysis_json, ...). Against that shape every insert failed
-- (missing `data`, violated NOT NULLs) and every read returned an undefined `data`.
--
-- This migration converts them IN PLACE and is safe to run repeatedly and on an already-converted DB:
--   1) add the `data` column,
--   2) backfill it from the legacy typed columns for any existing rows,
--   3) relax the legacy NOT NULLs so blob-only writes succeed (columns are kept, not dropped, so
--      migration 0001's (user_id, status)/(user_id, stage) indexes stay valid; a later cleanup
--      migration may drop them once confirmed unused),
--   4) dedupe job_analyses and add the (user_id, job_id) uniqueness that lets upsert replace.
--
-- Guards use information_schema so each block is a no-op when the legacy column is already gone.

-- jobs -----------------------------------------------------------------------
alter table public.jobs add column if not exists data jsonb;

do $$
begin
  if exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'jobs' and column_name = 'company') then
    update public.jobs set data = jsonb_strip_nulls(jsonb_build_object(
      'id', id,
      'company', company,
      'role', role,
      'description', description,
      'url', url,
      'category', category,
      'salaryRange', salary_range,
      'location', location,
      'workMode', work_mode,
      'tags', to_jsonb(coalesce(tags, array[]::text[])),
      'createdAt', to_char(created_at at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
      'archived', coalesce(archived, false),
      'source', source
    ))
    where data is null or data = '{}'::jsonb;

    alter table public.jobs alter column company drop not null;
    alter table public.jobs alter column role drop not null;
    alter table public.jobs alter column description drop not null;
    alter table public.jobs alter column work_mode drop not null;
    alter table public.jobs alter column source drop not null;
  end if;
end $$;

update public.jobs set data = '{}'::jsonb where data is null;
alter table public.jobs alter column data set default '{}'::jsonb;
alter table public.jobs alter column data set not null;

-- applications ---------------------------------------------------------------
alter table public.applications add column if not exists data jsonb;

do $$
begin
  if exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'applications' and column_name = 'company') then
    update public.applications set data = jsonb_strip_nulls(jsonb_build_object(
      'id', id,
      'jobId', job_id,
      'company', company,
      'role', role,
      'salary', salary,
      'location', location,
      'workMode', work_mode,
      'stage', stage,
      'createdAt', to_char(created_at at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
      'appliedAt', to_char(applied_at at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
      'updatedAt', to_char(updated_at at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
      'notes', coalesce(notes, ''),
      'feedback', feedback,
      'rejectionReason', rejection_reason,
      'followUpAt', to_char(follow_up_at at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
      'matchScore', match_score,
      'priority', coalesce(priority, false),
      'recruiter', recruiter,
      'links', coalesce(links, '[]'::jsonb),
      'events', coalesce(events, '[]'::jsonb)
    ))
    where data is null or data = '{}'::jsonb;

    alter table public.applications alter column company drop not null;
    alter table public.applications alter column role drop not null;
    alter table public.applications alter column work_mode drop not null;
    alter table public.applications alter column stage drop not null;
    alter table public.applications alter column updated_at drop not null;
  end if;
end $$;

update public.applications set data = '{}'::jsonb where data is null;
alter table public.applications alter column data set default '{}'::jsonb;
alter table public.applications alter column data set not null;

-- job_analyses ---------------------------------------------------------------
alter table public.job_analyses add column if not exists data jsonb;

do $$
begin
  if exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'job_analyses' and column_name = 'analysis_json') then
    update public.job_analyses set data = analysis_json where data is null or data = '{}'::jsonb;
    alter table public.job_analyses alter column analysis_json drop not null;
  end if;
end $$;

-- Collapse pre-existing duplicates (repo used to insert a new row per save) — keep the newest.
delete from public.job_analyses a
  using public.job_analyses b
  where a.user_id = b.user_id
    and a.job_id = b.job_id
    and (a.created_at < b.created_at or (a.created_at = b.created_at and a.id < b.id));

update public.job_analyses set data = '{}'::jsonb where data is null;
alter table public.job_analyses alter column data set default '{}'::jsonb;
alter table public.job_analyses alter column data set not null;

create unique index if not exists uq_job_analyses_user_job on public.job_analyses (user_id, job_id);
