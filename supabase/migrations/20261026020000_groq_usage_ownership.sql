-- Restrict daily usage RPCs to the caller; only service_role may select another user.
create or replace function journal_private.consume_groq_daily_usage(p_user_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_today date := (now() at time zone 'UTC')::date;
  v_used int;
begin
  insert into journal_private.founder_groq_daily_usage(user_id, usage_date, used_count, updated_at)
  values(p_user_id, v_today, 1, now())
  on conflict(user_id, usage_date) do update
    set used_count = journal_private.founder_groq_daily_usage.used_count + 1, updated_at = now()
    where journal_private.founder_groq_daily_usage.used_count < 5
  returning used_count into v_used;
  if v_used is null then
    raise exception 'Daily AI allowance exhausted' using errcode = 'P0001';
  end if;
  return jsonb_build_object('limit', 5, 'used', v_used, 'remaining', 5-v_used, 'date', v_today);
end;
$$;

create or replace function public.journal_get_groq_daily_usage(p_user_id uuid default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := coalesce(p_user_id, auth.uid());
begin
  if v_uid is null or (
    current_setting('role', true) is distinct from 'service_role'
    and (auth.uid() is null or v_uid is distinct from auth.uid())
  ) then
    raise exception 'User ownership required' using errcode = '42501';
  end if;
  return journal_private.get_groq_daily_usage(v_uid);
end;
$$;
revoke all on function public.journal_get_groq_daily_usage(uuid) from public, anon;
grant execute on function public.journal_get_groq_daily_usage(uuid) to authenticated, service_role;

create or replace function public.journal_consume_groq_daily_usage(p_user_id uuid default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := coalesce(p_user_id, auth.uid());
begin
  if v_uid is null or (
    current_setting('role', true) is distinct from 'service_role'
    and (auth.uid() is null or v_uid is distinct from auth.uid())
  ) then
    raise exception 'User ownership required' using errcode = '42501';
  end if;
  return journal_private.consume_groq_daily_usage(v_uid);
end;
$$;
revoke all on function public.journal_consume_groq_daily_usage(uuid) from public, anon;
grant execute on function public.journal_consume_groq_daily_usage(uuid) to authenticated, service_role;
