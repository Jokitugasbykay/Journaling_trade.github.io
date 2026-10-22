-- Migration: 20261022000000_founder_groq_management.sql
-- Founder Groq API Management and Public Default AI Provider

create table if not exists journal_private.founder_groq_config (
  id int primary key default 1 check (id = 1),
  api_key text,
  masked_key text,
  model text not null default 'llama-3.3-70b-versatile',
  fallback_enabled boolean not null default true,
  status text not null default 'Not Configured',
  last_tested_at timestamptz,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id)
);

revoke all on journal_private.founder_groq_config from public, anon, authenticated;
grant select, insert, update, delete on journal_private.founder_groq_config to service_role;

-- Public status function (safe for any user, never leaks secret key)
create or replace function public.journal_groq_public_status()
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  cfg journal_private.founder_groq_config;
  has_key boolean;
begin
  select * into cfg from journal_private.founder_groq_config where id = 1;
  has_key := cfg.api_key is not null and length(trim(cfg.api_key)) > 0;
  return jsonb_build_object(
    'available', has_key and (cfg.status = 'Connected' or cfg.status = 'ready'),
    'default_provider', 'groq',
    'model', coalesce(cfg.model, 'llama-3.3-70b-versatile'),
    'fallback_enabled', coalesce(cfg.fallback_enabled, true),
    'status', case when has_key then coalesce(cfg.status, 'Connected') else 'Not Configured' end
  );
end $$;
revoke all on function public.journal_groq_public_status() from public, anon;
grant execute on function public.journal_groq_public_status() to authenticated;

-- Founder admin config retrieval (strictly checks is_founder)
create or replace function public.journal_founder_groq_admin_config()
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  uid uuid := auth.uid();
  cfg journal_private.founder_groq_config;
begin
  if uid is null or not journal_private.is_founder(uid) then
    raise exception 'Forbidden: Founder access required' using errcode = '42501';
  end if;
  select * into cfg from journal_private.founder_groq_config where id = 1;
  return jsonb_build_object(
    'configured', cfg.api_key is not null and length(trim(cfg.api_key)) > 0,
    'masked_key', coalesce(cfg.masked_key, ''),
    'model', coalesce(cfg.model, 'llama-3.3-70b-versatile'),
    'fallback_enabled', coalesce(cfg.fallback_enabled, true),
    'status', coalesce(cfg.status, 'Not Configured'),
    'last_tested_at', cfg.last_tested_at,
    'updated_at', cfg.updated_at
  );
end $$;
revoke all on function public.journal_founder_groq_admin_config() from public, anon;
grant execute on function public.journal_founder_groq_admin_config() to authenticated;

-- Founder admin config update (strictly checks is_founder)
create or replace function public.journal_founder_set_groq_config(
  p_api_key text default null,
  p_model text default null,
  p_fallback_enabled boolean default null,
  p_status text default null
) returns jsonb language plpgsql security definer set search_path='' as $$
declare
  uid uuid := auth.uid();
  v_masked text;
  v_key text;
  cfg journal_private.founder_groq_config;
begin
  if uid is null or not journal_private.is_founder(uid) then
    raise exception 'Forbidden: Founder access required' using errcode = '42501';
  end if;

  select * into cfg from journal_private.founder_groq_config where id = 1;
  v_key := coalesce(nullif(trim(p_api_key), ''), cfg.api_key);
  
  if v_key is not null and length(v_key) >= 8 then
    v_masked := 'gsk_...' || right(v_key, 4);
  else
    v_masked := cfg.masked_key;
  end if;

  insert into journal_private.founder_groq_config (
    id, api_key, masked_key, model, fallback_enabled, status, last_tested_at, updated_at, updated_by
  ) values (
    1,
    v_key,
    v_masked,
    coalesce(nullif(trim(p_model), ''), coalesce(cfg.model, 'llama-3.3-70b-versatile')),
    coalesce(p_fallback_enabled, coalesce(cfg.fallback_enabled, true)),
    coalesce(p_status, case when v_key is not null then 'Connected' else 'Not Configured' end),
    now(),
    now(),
    uid
  ) on conflict (id) do update set
    api_key = coalesce(v_key, journal_private.founder_groq_config.api_key),
    masked_key = coalesce(v_masked, journal_private.founder_groq_config.masked_key),
    model = coalesce(nullif(trim(p_model), ''), journal_private.founder_groq_config.model),
    fallback_enabled = coalesce(p_fallback_enabled, journal_private.founder_groq_config.fallback_enabled),
    status = coalesce(p_status, journal_private.founder_groq_config.status),
    last_tested_at = now(),
    updated_at = now(),
    updated_by = uid;

  return public.journal_founder_groq_admin_config();
end $$;
revoke all on function public.journal_founder_set_groq_config(text,text,boolean,text) from public, anon;
grant execute on function public.journal_founder_set_groq_config(text,text,boolean,text) to authenticated;

-- Founder admin config deletion (strictly checks is_founder)
create or replace function public.journal_founder_delete_groq_config()
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null or not journal_private.is_founder(uid) then
    raise exception 'Forbidden: Founder access required' using errcode = '42501';
  end if;

  update journal_private.founder_groq_config set
    api_key = null,
    masked_key = null,
    status = 'Not Configured',
    updated_at = now(),
    updated_by = uid
  where id = 1;

  return jsonb_build_object('ok', true, 'message', 'Founder Groq API Key telah dihapus');
end $$;
revoke all on function public.journal_founder_delete_groq_config() from public, anon;
grant execute on function public.journal_founder_delete_groq_config() to authenticated;

-- Internal secret key accessor (service_role only, revoked from all user accounts)
create or replace function journal_private.get_founder_groq_key()
returns text language plpgsql security definer set search_path='' as $$
declare
  v_key text;
begin
  select api_key into v_key from journal_private.founder_groq_config where id = 1;
  return v_key;
end $$;
revoke all on function journal_private.get_founder_groq_key() from public, anon, authenticated;
grant execute on function journal_private.get_founder_groq_key() to service_role;
