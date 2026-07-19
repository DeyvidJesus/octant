-- 0003_normalize_knowledge_base.sql
-- Phase 5: Relational normalization for the Knowledge Base.
--
-- Extracts the four high-churn / structural collections from the `resumes.knowledge_base` JSONB
-- blob into their own tables, so editing one bullet is an UPDATE of one `resume_facts` row instead
-- of re-uploading the entire career graph. The remaining collections (profile, initiatives, metrics,
-- technical_decisions, stories, credentials, portfolio, publications, learning, unclassified) stay
-- in `resumes.knowledge_base` as a slim residual document.
--
-- Fact↔role / fact↔skill / fact↔initiative links are many-to-many and are kept as id arrays inside
-- each fact's `data` payload (so a bullet edit stays a single-row write). The one genuine 1:N
-- relationship — role → organization — is expressed as a real foreign key.

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

-- CREATE POLICY has no IF NOT EXISTS; drop-then-create keeps this migration idempotent and safe to
-- run standalone or after the baseline schema (which also declares these tables + policies).
drop policy if exists "Users can only access their own resume organizations" on public.resume_organizations;
create policy "Users can only access their own resume organizations" on public.resume_organizations for all using (auth.uid() = user_id);

drop policy if exists "Users can only access their own resume roles" on public.resume_roles;
create policy "Users can only access their own resume roles" on public.resume_roles for all using (auth.uid() = user_id);

drop policy if exists "Users can only access their own resume skills" on public.resume_skills;
create policy "Users can only access their own resume skills" on public.resume_skills for all using (auth.uid() = user_id);

drop policy if exists "Users can only access their own resume facts" on public.resume_facts;
create policy "Users can only access their own resume facts" on public.resume_facts for all using (auth.uid() = user_id);

-- Every read is "all rows for the current user" (the graph is reassembled client-side).
create index if not exists idx_resume_organizations_user_id on public.resume_organizations (user_id);
create index if not exists idx_resume_roles_user_id on public.resume_roles (user_id);
create index if not exists idx_resume_skills_user_id on public.resume_skills (user_id);
create index if not exists idx_resume_facts_user_id on public.resume_facts (user_id);

-- Supports the role → organization foreign key (cascade of ON DELETE SET NULL, and role lookups).
create index if not exists idx_resume_roles_organization_id on public.resume_roles (organization_id);
