-- Snapshot of the projected master resume, published by the client so the offline worker can score jobs.

alter table public.search_profiles add column if not exists scoring_snapshot jsonb;
