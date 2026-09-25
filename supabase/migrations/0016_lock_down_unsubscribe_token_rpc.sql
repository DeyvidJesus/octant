-- Restricts email_unsubscribe_token to service_role: it is SECURITY DEFINER and takes any uid, so clients could read other users' tokens.
-- The 0007 plan helpers stay public because RLS policies call them as the requesting role.

revoke execute on function public.email_unsubscribe_token(uuid) from public, anon, authenticated;
grant execute on function public.email_unsubscribe_token(uuid) to service_role;
