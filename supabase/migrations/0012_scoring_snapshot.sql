-- 0012_scoring_snapshot.sql
-- Phase 14 (Discovery redesign, Agent phase): a scoring snapshot so the deterministic analyzer can
-- run SERVER-SIDE (offline worker) without reassembling the normalized knowledge base. The client
-- publishes its projected Master Resume here whenever the knowledge base changes; the worker reads it
-- to score discovered candidates while the user is offline.

alter table public.search_profiles add column if not exists scoring_snapshot jsonb;
