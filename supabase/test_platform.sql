begin;
insert into auth.users(id,email) values('a0b10000-0000-4000-a000-000000000001','platform-a@example.invalid'),('a0b10000-0000-4000-a000-000000000002','platform-b@example.invalid');
insert into public.trading_accounts(id,user_id,name) values('a0b10000-0000-4000-a000-000000000011','a0b10000-0000-4000-a000-000000000001','A'),('a0b10000-0000-4000-a000-000000000012','a0b10000-0000-4000-a000-000000000002','B');
insert into public.trades(id,user_id,account_id,symbol,side) values('a0b10000-0000-4000-a000-000000000021','a0b10000-0000-4000-a000-000000000001','a0b10000-0000-4000-a000-000000000011','EURUSD','long'),('a0b10000-0000-4000-a000-000000000022','a0b10000-0000-4000-a000-000000000002','a0b10000-0000-4000-a000-000000000012','EURUSD','long');
set local role service_role;
select public.journal_record_subscription('test','upgrade',repeat('a',64),'a0b10000-0000-4000-a000-000000000001','sub-a','pro','active','year',now()-interval '40 days',now()+interval '325 days',now(),'{ID,US}');
select public.journal_record_subscription('test','plus',repeat('b',64),'a0b10000-0000-4000-a000-000000000002','sub-b','plus','active','month',now()-interval '1 day',now()+interval '29 days',now(),'{ID}');
insert into storage.objects(bucket_id,name) values('journal-reports','a0b10000-0000-4000-a000-000000000001/test.pdf'),('journal-reports','a0b10000-0000-4000-a000-000000000002/test.pdf');
insert into storage.objects(bucket_id,name) values('journal-imports','a0b10000-0000-4000-a000-000000000002/'||repeat('f',64)||'.csv');
set local role authenticated;
select set_config('request.jwt.claim.sub','a0b10000-0000-4000-a000-000000000001',true);
do $$ declare a jsonb; j jsonb; n integer; begin
 a:=public.journal_platform_access();
 assert a->>'plan'='pro','Pro entitlement absent';
 assert jsonb_array_length(public.journal_pro_analytics())=1,'Legacy Pro RPC ownership';
 assert (a->>'periodStart')::timestamptz>now()-interval '40 days','Annual monthly anchor missing';
 assert (a->>'periodEnd')::timestamptz<(now()+interval '32 days'),'Annual allowance not monthly';
 assert not has_table_privilege('authenticated','journal_private.subscriptions','UPDATE'),'Browser plan write';
 assert not has_table_privilege('authenticated','journal_private.usage_periods','UPDATE'),'Browser quota write';
 assert not has_function_privilege('authenticated','public.journal_finish_job(uuid,uuid,jsonb,text)','EXECUTE'),'User completion privilege';
 assert not has_function_privilege('anon','public.journal_platform_access()','EXECUTE'),'Anon access privilege';
 assert not has_function_privilege('authenticated','journal_private.user_access(uuid)','EXECUTE'),'Cross-user entitlement privilege';
 assert (select count(*)=1 from storage.objects),'Other storage objects visible';
 begin insert into storage.objects(bucket_id,name) values('journal-reports',auth.uid()::text||'/forbidden.pdf'); raise exception 'User report upload allowed'; exception when insufficient_privilege then null; end;
 begin insert into storage.objects(bucket_id,name) values('journal-imports','a0b10000-0000-4000-a000-000000000002/'||repeat('a',64)||'.csv'); raise exception 'Foreign import upload allowed'; exception when insufficient_privilege then null; end;
 insert into storage.objects(bucket_id,name) values('journal-imports',auth.uid()::text||'/'||repeat('a',64)||'.csv');
 insert into public.risk_rules(user_id,name,kind,threshold) values(auth.uid(),'Risk limit','max_risk_percent',1);
 assert (select count(*)=1 from public.risk_rules),'Owned risk rule missing';
 begin insert into public.risk_rules(user_id,name,kind,threshold) values('a0b10000-0000-4000-a000-000000000002','Foreign','max_risk_percent',1); raise exception 'Foreign rule accepted'; exception when insufficient_privilege then null; end;
 begin insert into public.performance_reviews(user_id,account_id,period,period_start,timezone,summary) values(auth.uid(),'a0b10000-0000-4000-a000-000000000012','weekly',current_date,'UTC','{}'); raise exception 'Foreign account review accepted'; exception when insufficient_privilege then null; end;
 begin insert into public.trade_executions(user_id,trade_id,side,quantity,price,executed_at) values(auth.uid(),'a0b10000-0000-4000-a000-000000000022','open',1,1,now()); raise exception 'Foreign trade execution accepted'; exception when insufficient_privilege then null; end;
 insert into public.trade_executions(user_id,trade_id,side,quantity,price,executed_at) values(auth.uid(),'a0b10000-0000-4000-a000-000000000021','close',1,1,now());
 j:=public.journal_create_job('journal','{}','a0b10000-0000-4000-a000-000000000031',repeat('c',64));
 assert public.journal_create_job('journal','{}','a0b10000-0000-4000-a000-000000000031',repeat('c',64))->>'id'=j->>'id','Idempotency duplicate';
 begin perform public.journal_create_job('market','{}','a0b10000-0000-4000-a000-000000000031',repeat('c',64)); raise exception 'Idempotency mismatch accepted'; exception when invalid_parameter_value then null; end;
 assert (public.journal_platform_access()->>'aiReserved')::int=1,'Reservation not counted';
 perform public.journal_cancel_job((j->>'id')::uuid);
 assert (public.journal_platform_access()->>'aiReserved')::int=0,'Cancellation not released';
 j:=public.journal_create_job('review','{"period":"weekly","start":"2026-10-05","tz":"UTC"}',gen_random_uuid(),repeat('c',64));
 assert public.journal_create_job('review','{"period":"weekly","start":"2026-10-05","tz":"UTC"}',gen_random_uuid(),repeat('c',64))->>'id'=j->>'id','Duplicate review job';
 perform public.journal_cancel_job((j->>'id')::uuid);
 for n in 1..30 loop perform public.journal_create_job('behaviour',jsonb_build_object('n',n),gen_random_uuid(),repeat('d',64)); end loop;
 assert (public.journal_platform_access()->>'aiRemaining')::int=0,'Shared quota incorrect';
 begin perform public.journal_create_job('market','{}',gen_random_uuid(),repeat('d',64)); raise exception '31st analysis accepted'; exception when raise_exception then assert sqlerrm='AI allowance exhausted','Unexpected quota error'; end;
 assert public.journal_rate_limit('pro_upload',10,600),'First rate-limit request rejected';
 for n in 2..10 loop assert public.journal_rate_limit('pro_upload',10,600),'Valid upload allowance rejected'; end loop;
 assert not public.journal_rate_limit('pro_upload',10,600),'11th upload rate-limit request accepted';
 begin perform public.journal_rate_limit('pro_upload',1000,1); raise exception 'Rate policy override accepted'; exception when invalid_parameter_value then null; end;
 for n in 1..3 loop perform public.journal_create_job('report','{}',gen_random_uuid(),repeat('c',64)); end loop;
 begin perform public.journal_create_job('report','{}',gen_random_uuid(),repeat('c',64)); raise exception 'Fourth concurrent report allowed'; exception when raise_exception then assert sqlerrm='Report concurrency limit','Unexpected report limit error'; end;
 for j in select to_jsonb(x) from public.platform_jobs x where kind='report' loop perform public.journal_cancel_job((j->>'id')::uuid); end loop;
 for n in 4..10 loop j:=public.journal_create_job('report','{}',gen_random_uuid(),repeat('c',64)); perform public.journal_cancel_job((j->>'id')::uuid); perform public.journal_delete_job((j->>'id')::uuid); end loop;
 begin perform public.journal_create_job('report','{}',gen_random_uuid(),repeat('c',64)); raise exception 'Report deletion reset rate'; exception when raise_exception then assert sqlerrm='Report rate limit','Unexpected report rate error'; end;
end $$;
set local role service_role;
do $$ declare jobs jsonb; j jsonb; worker uuid:=gen_random_uuid(); begin
 jobs:=public.journal_claim_jobs(worker,3);
 assert jsonb_array_length(jobs)=3,'Claim count';
 for j in select value from jsonb_array_elements(jobs) loop perform public.journal_finish_job((j->>'id')::uuid,worker,'{"validated":true}',null); end loop;
 jobs:=public.journal_claim_jobs(worker,1);
 perform public.journal_finish_job((jobs->0->>'id')::uuid,worker,null,'Model unavailable');
end $$;
set local role authenticated;
do $$ begin
 assert (public.journal_platform_access()->>'aiUsed')::int=3,'Successful usage count';
 assert (public.journal_platform_access()->>'aiReserved')::int=26,'Failure reservation release';
 assert (public.journal_platform_access()->>'aiRemaining')::int=1,'Failed analysis consumed quota';
end $$;
select set_config('request.jwt.claim.sub','a0b10000-0000-4000-a000-000000000002',true);
do $$ begin
 assert public.journal_platform_access()->>'plan'='plus','Plus entitlement';
 assert public.journal_platform_access()->'countries'='["ID"]'::jsonb,'Plus country restrictions';
 assert not exists(select 1 from public.platform_jobs),'Other jobs leaked';
 assert not exists(select 1 from public.risk_rules),'Other rules leaked';
 assert not exists(select 1 from public.trade_executions),'Other executions leaked';
 begin perform public.journal_create_job('market','{}',gen_random_uuid(),repeat('a',64)); raise exception 'Plus AI allowed'; exception when insufficient_privilege then null; end;
end $$;
reset role;
update public.platform_jobs set lease_until=now()-interval '1 second' where id=(select id from public.platform_jobs where status='queued' limit 1);
-- Expire a real running lease; queued jobs older than one hour are recovered separately.
update public.platform_jobs set status='running',worker_id=gen_random_uuid(),lease_until=now()-interval '1 second' where id=(select id from public.platform_jobs where status='queued' limit 1);
set local role service_role;
do $$ begin assert public.journal_recover_jobs()=1,'Lease recovery'; end $$;
select public.journal_record_subscription('test','expired',repeat('e',64),'a0b10000-0000-4000-a000-000000000001','sub-a','pro','active','month',now()-interval '31 days',now()-interval '1 day',now()+interval '1 second','{}');
set local role authenticated;
select set_config('request.jwt.claim.sub','a0b10000-0000-4000-a000-000000000001',true);
do $$ begin
 assert public.journal_platform_access()->>'plan'='free','Expired Pro retained';
 assert not exists(select 1 from public.platform_jobs),'Expired Pro result exposed';
 assert not exists(select 1 from public.risk_rules),'Expired Pro rules exposed';
 assert (select count(*)=1 from storage.objects),'Expired Pro report download remained';
 begin perform public.journal_pro_analytics(); raise exception 'Expired legacy RPC allowed'; exception when insufficient_privilege then null; end;
end $$;
reset role;
-- Free import quotas count successful completion timestamps, never attempted/failed jobs.
update journal_private.subscriptions set status='expired' where user_id='a0b10000-0000-4000-a000-000000000002';
set local role authenticated;
select set_config('request.jwt.claim.sub','a0b10000-0000-4000-a000-000000000002',true);
do $$ declare n integer; j jsonb; jobs jsonb; worker uuid:=gen_random_uuid(); begin
 for n in 1..10 loop
  j:=public.journal_create_job('import',jsonb_build_object('n',n,'storage_path',auth.uid()::text||'/'||repeat('f',64)||'.csv'),gen_random_uuid(),repeat('f',64));
  execute 'set local role service_role';
  -- A can still have queued AI jobs; claim batches until this import is reached.
  loop
   jobs:=public.journal_claim_jobs(worker,3);
   for j in select value from jsonb_array_elements(jobs) loop
    if j->>'kind'='import' then
     perform public.journal_confirm_import((j->>'id')::uuid,worker,jsonb_build_array(jsonb_build_object(
      'account_id','a0b10000-0000-4000-a000-000000000012','symbol','EURUSD','side','long','quantity','1','entry_price','1.1','exit_price','1.2','pnl','10',
      'opened_at',to_char(now()-make_interval(days=>n),'YYYY-MM-DD"T"HH24:MI:SS"Z"'),'closed_at',to_char(now(),'YYYY-MM-DD"T"HH24:MI:SS"Z"'))));
    else perform public.journal_finish_job((j->>'id')::uuid,worker,null,'Subscription expired'); end if;
   end loop;
   exit when exists(select 1 from jsonb_array_elements(jobs) x where x->>'kind'='import');
  end loop;
  execute 'set local role authenticated';
 end loop;
 begin perform public.journal_create_job('import',jsonb_build_object('storage_path',auth.uid()::text||'/'||repeat('f',64)||'.csv'),gen_random_uuid(),repeat('f',64)); raise exception '11th Free import accepted'; exception when raise_exception then assert sqlerrm='Import allowance exhausted','Unexpected import quota error'; end;
end $$;
reset role;
update public.platform_jobs set finished_at=now()-interval '12 hours 1 second' where user_id='a0b10000-0000-4000-a000-000000000002' and kind='import' and status='succeeded';
set local role authenticated;
do $$ begin perform public.journal_create_job('import',jsonb_build_object('storage_path',auth.uid()::text||'/'||repeat('f',64)||'.csv'),gen_random_uuid(),repeat('f',64)); end $$;
reset role;
-- Invalid imported rows roll back all earlier rows and never finalize usage.
set local role service_role;
do $$ declare jobs jsonb; j jsonb; worker uuid:=gen_random_uuid(); before_count integer; begin
 jobs:=public.journal_claim_jobs(worker,1); j:=jobs->0;
 select count(*) into before_count from public.trades;
 begin
  perform public.journal_confirm_import((j->>'id')::uuid,worker,'[{"account_id":"a0b10000-0000-4000-a000-000000000011","symbol":"USDJPY","side":"long","quantity":"1","entry_price":"1","exit_price":"2","opened_at":"2026-10-01T12:00:00Z","closed_at":"2026-10-02T12:00:00Z"}]');
  raise exception 'Foreign account import allowed';
 exception when insufficient_privilege then null; end;
 assert (select count(*)=before_count from public.trades),'Failed import inserted rows';
 perform public.journal_finish_job((j->>'id')::uuid,worker,null,'Invalid imported account');
 assert public.journal_user_access('a0b10000-0000-4000-a000-000000000002')->>'plan'='free','Free status changed';
end $$;
reset role;
rollback;
