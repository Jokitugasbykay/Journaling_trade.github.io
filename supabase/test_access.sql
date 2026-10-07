begin;
do $$
declare uid uuid; state jsonb; n integer;
begin
 select id into uid from auth.users where email='gamingyoga14@gmail.com';
 assert uid is not null,'Founder account missing';
 perform set_config('request.jwt.claim.sub',uid::text,true);
 update journal_private.account_access set plan='free',uploads_used=0,window_started_at=null where user_id=uid;
 for n in 1..10 loop
  state := public.journal_access(true);
  assert (state->>'allowed')::boolean and (state->>'remaining')::integer=10-n,'Free quota incorrect';
 end loop;
 state := public.journal_access(true);
 assert not (state->>'allowed')::boolean,'11th Free upload accepted';
 update journal_private.account_access set window_started_at=now()-interval '12 hours 1 second' where user_id=uid;
 state := public.journal_access(true);
 assert (state->>'allowed')::boolean and (state->>'remaining')::integer=9,'12 hour reset failed';
 update journal_private.account_access set plan='plus' where user_id=uid;
 for n in 1..15 loop
  state := public.journal_access(true);
  assert (state->>'allowed')::boolean and state->>'remaining' is null,'Plus limited';
 end loop;
 assert not has_table_privilege('authenticated','journal_private.account_access','UPDATE'),'Users can edit their plan';
 perform set_config('request.jwt.claim.sub','',true);
 begin
  perform public.journal_access();
  raise exception 'Anonymous access accepted';
 exception when invalid_authorization_specification then null;
 end;
end $$;
rollback;
