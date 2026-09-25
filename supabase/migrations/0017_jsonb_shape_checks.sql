-- Shape checks on the JSONB documents: RLS decides who writes a row, these decide what a row may hold.
-- Added NOT VALID so legacy rows never block the migration; each is validated below when existing rows pass.

-- True when `doc` is an object whose `keys` are all JSON strings. Never NULL: a CHECK treats NULL as a pass.
create or replace function public.jsonb_has_strings(doc jsonb, keys text[])
  returns boolean language sql immutable parallel safe
as $$
  select coalesce(jsonb_typeof(doc), '') = 'object'
     and not exists (select 1 from unnest(keys) as k where coalesce(jsonb_typeof(doc -> k), '') <> 'string')
$$;

-- Entity rows: the document id must match the row id and the fields the app reads must exist.
-- Each check is wrapped in coalesce(..., false) because a CHECK that evaluates to NULL passes.
alter table public.jobs drop constraint if exists jobs_data_shape;
alter table public.jobs add constraint jobs_data_shape check (coalesce((
  public.jsonb_has_strings(data, array['id', 'company', 'role'])
  and data ->> 'id' = id::text
  and octet_length(data::text) <= 262144
), false)) not valid;

alter table public.applications drop constraint if exists applications_data_shape;
alter table public.applications add constraint applications_data_shape check (coalesce((
  public.jsonb_has_strings(data, array['id', 'company', 'role', 'stage'])
  and data ->> 'id' = id::text
  and data ->> 'stage' in ('saved', 'applied', 'screening', 'interviewing', 'technical', 'offer',
                           'accepted', 'rejected', 'withdrawn', 'ghosted')
  and jsonb_typeof(data -> 'events') = 'array'
  and octet_length(data::text) <= 262144
), false)) not valid;

alter table public.job_analyses drop constraint if exists job_analyses_data_shape;
alter table public.job_analyses add constraint job_analyses_data_shape check (coalesce((
  public.jsonb_has_strings(data, array['jobId'])
  and data ->> 'jobId' = job_id::text
  and jsonb_typeof(data -> 'match') = 'object'
  and octet_length(data::text) <= 262144
), false)) not valid;

alter table public.tailored_resumes drop constraint if exists tailored_resumes_data_shape;
alter table public.tailored_resumes add constraint tailored_resumes_data_shape check (coalesce((
  public.jsonb_has_strings(data, array['jobId'])
  and data ->> 'jobId' = job_id::text
  and jsonb_typeof(data -> 'experience') = 'array'
  and octet_length(data::text) <= 524288
), false)) not valid;

alter table public.discovered_jobs drop constraint if exists discovered_jobs_data_shape;
alter table public.discovered_jobs add constraint discovered_jobs_data_shape check (coalesce((
  public.jsonb_has_strings(data, array['id', 'company', 'role'])
  and data ->> 'id' = id::text
  and octet_length(data::text) <= 262144
), false)) not valid;

alter table public.resume_organizations drop constraint if exists resume_organizations_data_shape;
alter table public.resume_organizations add constraint resume_organizations_data_shape check (coalesce((
  public.jsonb_has_strings(data, array['id', 'name']) and data ->> 'id' = id::text
  and octet_length(data::text) <= 65536
), false)) not valid;

alter table public.resume_roles drop constraint if exists resume_roles_data_shape;
alter table public.resume_roles add constraint resume_roles_data_shape check (coalesce((
  public.jsonb_has_strings(data, array['id', 'title']) and data ->> 'id' = id::text
  and octet_length(data::text) <= 65536
), false)) not valid;

alter table public.resume_skills drop constraint if exists resume_skills_data_shape;
alter table public.resume_skills add constraint resume_skills_data_shape check (coalesce((
  public.jsonb_has_strings(data, array['id', 'canonical']) and data ->> 'id' = id::text
  and octet_length(data::text) <= 65536
), false)) not valid;

alter table public.resume_facts drop constraint if exists resume_facts_data_shape;
alter table public.resume_facts add constraint resume_facts_data_shape check (coalesce((
  public.jsonb_has_strings(data, array['id', 'statement', 'status']) and data ->> 'id' = id::text
  and data ->> 'status' in ('confirmed', 'needs_review', 'todo')
  and octet_length(data::text) <= 65536
), false)) not valid;

-- Per-user documents: some upserts omit the column (default '{}'), so only require an object of sane size.
alter table public.resumes drop constraint if exists resumes_data_shape;
alter table public.resumes add constraint resumes_data_shape check (coalesce((
  jsonb_typeof(knowledge_base) = 'object' and octet_length(knowledge_base::text) <= 2097152
), false)) not valid;

alter table public.search_profiles drop constraint if exists search_profiles_data_shape;
alter table public.search_profiles add constraint search_profiles_data_shape check (coalesce((
  jsonb_typeof(data) = 'object' and octet_length(data::text) <= 65536
), false)) not valid;

alter table public.discoveries drop constraint if exists discoveries_data_shape;
alter table public.discoveries add constraint discoveries_data_shape check (coalesce((
  jsonb_typeof(state) = 'object' and octet_length(state::text) <= 1048576
), false)) not valid;

alter table public.settings drop constraint if exists settings_data_shape;
alter table public.settings add constraint settings_data_shape check (coalesce((
  preferences is null or (jsonb_typeof(preferences) = 'object' and octet_length(preferences::text) <= 65536)
), false)) not valid;

-- Validate what the existing data allows; a constraint with violating legacy rows stays NOT VALID (new
-- writes are still checked) and is reported, so those rows can be fixed and validated later.
do $$
declare
  c record;
begin
  for c in
    select conrelid::regclass as tbl, conname
    from pg_constraint
    where conname like '%\_data\_shape' and not convalidated
  loop
    begin
      execute format('alter table %s validate constraint %I', c.tbl, c.conname);
    exception when check_violation then
      raise notice '% on % stays NOT VALID: some existing rows violate it', c.conname, c.tbl;
    end;
  end loop;
end $$;
