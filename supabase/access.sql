create schema if not exists journal_private;
create table journal_private.account_access (
 user_id uuid primary key references auth.users(id) on delete cascade,
 plan text not null default 'free' check(plan in ('free','plus','pro')),
 uploads_used integer not null default 0 check(uploads_used between 0 and 10),
 window_started_at timestamptz
);
alter table journal_private.account_access enable row level security;
revoke all on journal_private.account_access from anon,authenticated;
alter table public.profiles add column nickname_set boolean not null default false;
create function journal_private.access_status(consume_upload boolean)
returns jsonb language plpgsql security definer set search_path='' as $$
declare uid uuid := auth.uid(); row journal_private.account_access; allowed boolean := true;
begin
 if uid is null then raise exception 'Authentication required' using errcode='28000'; end if;
 insert into journal_private.account_access(user_id) values(uid) on conflict do nothing;
 select * into row from journal_private.account_access where user_id=uid for update;
 if row.window_started_at is not null and row.window_started_at + interval '12 hours' <= now() then
  row.uploads_used := 0; row.window_started_at := null;
 end if;
 if consume_upload and row.plan='free' then
  if row.uploads_used >= 10 then allowed := false;
  else
   row.window_started_at := coalesce(row.window_started_at,now());
   row.uploads_used := row.uploads_used+1;
  end if;
 end if;
 update journal_private.account_access set uploads_used=row.uploads_used,window_started_at=row.window_started_at where user_id=uid;
 return jsonb_build_object('plan',row.plan,'allowed',allowed,'remaining',case when row.plan='free' then 10-row.uploads_used else null end,'resetAt',case when row.window_started_at is not null then row.window_started_at+interval '12 hours' else null end);
end $$;
revoke all on function journal_private.access_status(boolean) from public,anon;
grant usage on schema journal_private to authenticated;
grant execute on function journal_private.access_status(boolean) to authenticated;
create function public.journal_access(consume_upload boolean default false)
returns jsonb language sql security invoker set search_path='' as $$ select journal_private.access_status(consume_upload); $$;
revoke all on function public.journal_access(boolean) from public,anon;
grant execute on function public.journal_access(boolean) to authenticated;
