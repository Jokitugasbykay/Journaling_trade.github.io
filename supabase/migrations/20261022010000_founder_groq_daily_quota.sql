-- Migration: 20261022010000_founder_groq_daily_quota.sql
-- Enforces a maximum 5 AI messages per user per day for Founder Groq API

create table if not exists journal_private.founder_groq_daily_usage (
  user_id uuid not null references auth.users(id) on delete cascade,
  usage_date date not null default ((now() at time zone 'UTC')::date),
  used_count int not null default 0,
  updated_at timestamptz not null default now(),
  primary key (user_id, usage_date)
);

revoke all on journal_private.founder_groq_daily_usage from public, anon, authenticated;
grant select, insert, update on journal_private.founder_groq_daily_usage to service_role;

-- Internal RPC to get daily usage
create or replace function journal_private.get_groq_daily_usage(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_today date := (now() at time zone 'UTC')::date;
  v_used int := 0;
  v_limit int := 5;
begin
  select coalesce(used_count, 0) into v_used
  from journal_private.founder_groq_daily_usage
  where user_id = p_user_id and usage_date = v_today;

  return jsonb_build_object(
    'limit', v_limit,
    'used', coalesce(v_used, 0),
    'remaining', greatest(0, v_limit - coalesce(v_used, 0)),
    'date', v_today
  );
end $function$;

-- Internal RPC to atomically consume 1 message quota
create or replace function journal_private.consume_groq_daily_usage(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_today date := (now() at time zone 'UTC')::date;
  v_used int;
  v_limit int := 5;
begin
  insert into journal_private.founder_groq_daily_usage (user_id, usage_date, used_count, updated_at)
  values (p_user_id, v_today, 1, now())
  on conflict (user_id, usage_date) do update set
    used_count = journal_private.founder_groq_daily_usage.used_count + 1,
    updated_at = now()
  returning used_count into v_used;

  return jsonb_build_object(
    'limit', v_limit,
    'used', v_used,
    'remaining', greatest(0, v_limit - v_used),
    'date', v_today
  );
end $function$;

-- Public wrapper functions callable by authenticated users and service_role
create or replace function public.journal_get_groq_daily_usage(p_user_id uuid default null)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_uid uuid := coalesce(p_user_id, auth.uid());
begin
  if v_uid is null then
    raise exception 'User ID required' using errcode = '42501';
  end if;
  return journal_private.get_groq_daily_usage(v_uid);
end;
$$;

create or replace function public.journal_consume_groq_daily_usage(p_user_id uuid default null)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_uid uuid := coalesce(p_user_id, auth.uid());
begin
  if v_uid is null then
    raise exception 'User ID required' using errcode = '42501';
  end if;
  return journal_private.consume_groq_daily_usage(v_uid);
end;
$$;

revoke all on function public.journal_get_groq_daily_usage(uuid) from public, anon;
grant execute on function public.journal_get_groq_daily_usage(uuid) to authenticated, service_role;

revoke all on function public.journal_consume_groq_daily_usage(uuid) from public, anon;
grant execute on function public.journal_consume_groq_daily_usage(uuid) to authenticated, service_role;
