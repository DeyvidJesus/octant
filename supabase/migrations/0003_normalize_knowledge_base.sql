-- Moves organizations, roles, skills and facts out of resumes.knowledge_base into their own tables.
-- Many-to-many links stay as id arrays inside each row's data; only role -> organization is a real FK.

create table if not exists public.resume_organizations (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users not null,
  data jsonb not null default '{}'::jsonb
);

create table if not exists public.resume_roles (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users not null,
  organization_id uuid references public.resume_organizations (id) on delete set null,
  data jsonb not null default '{}'::jsonb
);

create table if not exists public.resume_skills (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users not null,
  data jsonb not null default '{}'::jsonb
);

create table if not exists public.resume_facts (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users not null,
  data jsonb not null default '{}'::jsonb
);

alter table public.resume_organizations enable row level security;
alter table public.resume_roles enable row level security;
alter table public.resume_skills enable row level security;
alter table public.resume_facts enable row level security;

-- CREATE POLICY has no IF NOT EXISTS, so drop first to stay idempotent.
drop policy if exists "Users can only access their own resume organizations" on public.resume_organizations;
create policy "Users can only access their own resume organizations" on public.resume_organizations for all using (auth.uid() = user_id);

drop policy if exists "Users can only access their own resume roles" on public.resume_roles;
create policy "Users can only access their own resume roles" on public.resume_roles for all using (auth.uid() = user_id);

drop policy if exists "Users can only access their own resume skills" on public.resume_skills;
create policy "Users can only access their own resume skills" on public.resume_skills for all using (auth.uid() = user_id);

drop policy if exists "Users can only access their own resume facts" on public.resume_facts;
create policy "Users can only access their own resume facts" on public.resume_facts for all using (auth.uid() = user_id);

create index if not exists idx_resume_organizations_user_id on public.resume_organizations (user_id);
create index if not exists idx_resume_roles_user_id on public.resume_roles (user_id);
create index if not exists idx_resume_skills_user_id on public.resume_skills (user_id);
create index if not exists idx_resume_facts_user_id on public.resume_facts (user_id);

create index if not exists idx_resume_roles_organization_id on public.resume_roles (organization_id);
