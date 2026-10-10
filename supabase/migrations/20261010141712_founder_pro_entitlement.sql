-- Only verified, explicitly allowlisted Founder identities receive Pro access.
create or replace function journal_private.is_founder(p_user_id uuid)
returns boolean language sql stable security definer set search_path=''
as $$
 select exists(select 1 from auth.users u where u.id=p_user_id and u.email_confirmed_at is not null
  and lower(u.email) in ('kaylafisika24@gmail.com','gamingyoga14@gmail.com'));
$$;
revoke all on function journal_private.is_founder(uuid) from public,anon,authenticated,service_role;

create or replace function journal_private.access_status(consume_upload boolean)
returns jsonb language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); row journal_private.account_access; allowed boolean:=true; founder boolean; tier text;
begin
 if uid is null then raise exception 'Authentication required' using errcode='28000'; end if;
 insert into journal_private.account_access(user_id) values(uid) on conflict do nothing;
 select * into row from journal_private.account_access where user_id=uid for update;
 founder:=journal_private.is_founder(uid);
 if row.window_started_at is not null and row.window_started_at+interval '12 hours'<=now() then
  row.uploads_used:=0; row.window_started_at:=null;
 end if;
 tier:=case when founder then 'pro' else row.plan end;
 if consume_upload and tier='free' then
  if row.uploads_used>=10 then allowed:=false;
  else row.window_started_at:=coalesce(row.window_started_at,now()); row.uploads_used:=row.uploads_used+1;
  end if;
 end if;
 update journal_private.account_access set uploads_used=row.uploads_used,window_started_at=row.window_started_at where user_id=uid;
 return jsonb_build_object('plan',tier,'founder',founder,'allowed',allowed,
  'remaining',case when tier='free' then 10-row.uploads_used else null end,
  'resetAt',case when row.window_started_at is not null then row.window_started_at+interval '12 hours' else null end,
  'effectiveUntil',case when tier='pro' then '9999-12-31 23:59:59+00'::timestamptz else null end,
  'aiLimit',case when tier='pro' then 30 else 0 end,'aiUsed',0,'aiReserved',0,
  'aiRemaining',case when tier='pro' then 30 else 0 end);
end $$;

create or replace function public.journal_founder_entitlements()
returns jsonb language sql security invoker set search_path='' as $$
 select journal_private.access_status(false);
$$;
revoke all on function public.journal_founder_entitlements() from public,anon;
grant execute on function public.journal_founder_entitlements() to authenticated;
