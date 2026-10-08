begin;
insert into auth.users(id,email) values ('a0b10000-0000-4000-a000-000000000001','security-a@example.invalid'),('a0b10000-0000-4000-a000-000000000002','security-b@example.invalid');
insert into public.trading_accounts(id,user_id,name) values('a0b10000-0000-4000-a000-000000000011','a0b10000-0000-4000-a000-000000000001','Test A'),('a0b10000-0000-4000-a000-000000000012','a0b10000-0000-4000-a000-000000000002','Test B');
set local role authenticated;
select set_config('request.jwt.claim.sub','a0b10000-0000-4000-a000-000000000001',true);
do $$
begin
 assert (select count(*)=1 from public.trading_accounts),'Ownership SELECT failed';
 assert not exists(select 1 from public.trading_accounts where user_id='a0b10000-0000-4000-a000-000000000002'),'Other account visible';
 update public.trading_accounts set name='Forbidden' where user_id='a0b10000-0000-4000-a000-000000000002';
 assert not found,'Other account updated';
 begin
  insert into public.trading_accounts(user_id,name) values('a0b10000-0000-4000-a000-000000000002','Forbidden');
  raise exception 'Other account insert accepted';
 exception when insufficient_privilege then null;
 end;
 begin
  insert into public.trades(user_id,account_id,symbol,side) values('a0b10000-0000-4000-a000-000000000001','a0b10000-0000-4000-a000-000000000012','EURUSD','long');
  raise exception 'Other account relation accepted';
 exception when insufficient_privilege then null;
 end;
 assert not has_table_privilege('authenticated','journal_private.account_access','UPDATE'),'Plan privilege exposed';
end $$;
set local role anon;
do $$ begin
 assert not has_function_privilege('anon','public.journal_access(boolean)','EXECUTE'),'Anonymous RPC exposed';
 assert not exists(select 1 from public.trading_accounts),'Anonymous rows exposed';
end $$;
rollback;
