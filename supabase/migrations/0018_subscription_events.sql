-- Subscriptions: stream tier changes to the client, and ignore Stripe events older than the last one applied.
-- Stripe does not guarantee delivery order, so a late `.updated` could otherwise undo a `.deleted`.

alter table public.subscriptions add column if not exists stripe_event_created timestamptz;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables
                     where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'subscriptions') then
    alter publication supabase_realtime add table public.subscriptions;
  end if;
end $$;

-- Upserts the tier only when the event is at least as new as the stored one; returns whether it applied.
-- The comparison sits in ON CONFLICT ... WHERE, so two concurrent deliveries cannot interleave.
create or replace function public.apply_subscription_event(
  p_user_id uuid,
  p_tier text,
  p_status text,
  p_customer_id text,
  p_subscription_id text,
  p_current_period_end timestamptz,
  p_event_created timestamptz
) returns boolean
  language sql
as $$
  with applied as (
    insert into public.subscriptions as s
      (user_id, tier, status, stripe_customer_id, stripe_subscription_id, current_period_end,
       stripe_event_created, updated_at)
    values
      (p_user_id, p_tier, p_status, p_customer_id, p_subscription_id, p_current_period_end,
       p_event_created, timezone('utc'::text, now()))
    on conflict (user_id) do update set
      tier = excluded.tier,
      status = excluded.status,
      stripe_customer_id = excluded.stripe_customer_id,
      stripe_subscription_id = excluded.stripe_subscription_id,
      current_period_end = excluded.current_period_end,
      stripe_event_created = excluded.stripe_event_created,
      updated_at = excluded.updated_at
    where s.stripe_event_created is null or s.stripe_event_created <= excluded.stripe_event_created
    returning 1
  )
  select exists (select 1 from applied)
$$;

revoke execute on function public.apply_subscription_event(uuid, text, text, text, text, timestamptz, timestamptz)
  from public, anon, authenticated;
grant execute on function public.apply_subscription_event(uuid, text, text, text, text, timestamptz, timestamptz)
  to service_role;
