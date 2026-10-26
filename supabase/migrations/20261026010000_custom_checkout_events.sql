-- Only verified provider events may mutate subscriptions. A refund of an older order must not revoke a newer subscription.
create or replace function public.journal_record_midtrans_checkout(p_event jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare owner_id uuid:=(p_event->>'user_id')::uuid; current_order text;
begin
  perform pg_advisory_xact_lock(hashtextextended(owner_id::text,0));
  select provider_subscription_id into current_order from journal_private.subscriptions
    where user_id=owner_id and provider='midtrans';
  if p_event->>'status'='cancelled' and current_order is distinct from p_event->>'order_id' then
    return jsonb_build_object('ignored',true);
  end if;
  return public.journal_record_subscription('midtrans',p_event->>'event_id',p_event->>'payload_hash',owner_id,
    p_event->>'order_id',p_event->>'plan',p_event->>'status',p_event->>'interval',
    (p_event->>'period_start')::timestamptz,(p_event->>'period_end')::timestamptz,(p_event->>'event_at')::timestamptz,'{}'::text[]);
end $$;
revoke all on function public.journal_record_midtrans_checkout(jsonb) from public,anon,authenticated;
grant execute on function public.journal_record_midtrans_checkout(jsonb) to service_role;

-- Environment secrets take precedence; this restricted getter supports the existing sandbox credential in Vault.
create or replace function public.journal_midtrans_sandbox_key() returns text
language sql stable security definer set search_path='' as $$
  select decrypted_secret from vault.decrypted_secrets where name='journalingtrade_midtrans_sandbox' limit 1;
$$;
revoke all on function public.journal_midtrans_sandbox_key() from public,anon,authenticated;
grant execute on function public.journal_midtrans_sandbox_key() to service_role;
