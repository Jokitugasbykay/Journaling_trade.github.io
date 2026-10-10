-- Local test identities and evidence only; every write is rolled back.
begin;
insert into auth.users(id,email) values('d0b10000-0000-4000-a000-000000000001','intelligence-a@example.invalid'),('d0b10000-0000-4000-a000-000000000002','intelligence-b@example.invalid');
set local role service_role;
select public.journal_record_subscription('test','intel-a',repeat('a',64),'d0b10000-0000-4000-a000-000000000001','intel-a','pro','active','month',now()-interval '1 day',now()+interval '29 days',now(),'{US}');
select public.journal_record_subscription('test','intel-b',repeat('b',64),'d0b10000-0000-4000-a000-000000000002','intel-b','pro','active','month',now()-interval '1 day',now()+interval '29 days',now(),'{US}');
set local role authenticated;
select set_config('request.jwt.claim.sub','d0b10000-0000-4000-a000-000000000001',true);
do $$ declare j jsonb; before_quota jsonb; begin
 assert public.journal_market_preference() is null,'Style must not be silently defaulted';
 before_quota:=public.journal_platform_access();
 begin perform public.journal_create_job('market','{"instrument":"XAUUSD","timeframe":"15m"}',gen_random_uuid(),repeat('c',64)); raise exception 'Missing style bypass'; exception when invalid_parameter_value then null; end;
 assert public.journal_platform_access()->>'aiReserved'=before_quota->>'aiReserved','Rejected style reserved quota';
 assert public.journal_market_preference('SCALPING')->>'trading_style'='SCALPING';
 assert public.journal_market_preference('INTRADAY')->>'trading_style'='INTRADAY';
 assert (public.journal_notification_preference(true)->>'browser_notifications')::boolean,'Notification preference not saved';
 assert not (public.journal_notification_preference(false)->>'browser_notifications')::boolean,'Notification preference not disabled';
 assert public.journal_platform_access()->>'aiReserved'=before_quota->>'aiReserved','Style change consumed quota';
 begin update public.market_preferences set trading_style='SWING'; raise exception 'Direct preference modification allowed'; exception when insufficient_privilege then null; end;
 begin perform public.journal_market_preference('OTHER'); raise exception 'Invalid style accepted'; exception when invalid_parameter_value then null; end;
 j:=public.journal_create_job('market','{"instrument":"XAUUSD","timeframe":"15m","trading_style":"INTRADAY"}',gen_random_uuid(),repeat('c',64));
 perform public.journal_cancel_job((j->>'id')::uuid);
end $$;

set local role service_role;
insert into public.platform_jobs(id,user_id,kind,status,idempotency_key,payload_hash,payload,result,finished_at)
values('d0b10000-0000-4000-a000-000000000011','d0b10000-0000-4000-a000-000000000001','market','succeeded',gen_random_uuid(),repeat('d',64),'{}',
 jsonb_build_object('model_version','{"digest":"synthetic-evidence"}'::jsonb,'quantitative',jsonb_build_object('market',jsonb_build_object(
 'instrument','XAUUSD','timeframe','15m','valid_until',now()+interval '1 hour',
 'intelligence',jsonb_build_object('fundamental',jsonb_build_object('events','[]'::jsonb),'scenarios',jsonb_build_array(jsonb_build_object(
 'direction','BUY','setup_status','CONFIRMED','trading_style','INTRADAY','entry',100,'stop_loss',90,'take_profit_1',120,'risk_reward',2,'timestamp',now()-interval '1 minute')))))),now());

set local role authenticated;
do $$ declare s jsonb; a uuid; begin
 s:=public.journal_signal_action('d0b10000-0000-4000-a000-000000000011','BUY','watch');
 assert not (s->>'execution_confirmed')::boolean,'Watch counted as execution';
 assert (select count(*) from public.signal_alerts where signal_id=(s->>'id')::uuid)=7,'Missing persistent alerts';
 assert public.journal_signal_action('d0b10000-0000-4000-a000-000000000011','BUY','watch')->>'id'=s->>'id','Duplicate signal';
 begin perform public.journal_signal_action('d0b10000-0000-4000-a000-000000000011','BUY','take'); raise exception 'Take omitted tracking type'; exception when invalid_parameter_value then null; end;
 s:=public.journal_signal_action('d0b10000-0000-4000-a000-000000000011','BUY','take','paper');
 assert not (s->>'execution_confirmed')::boolean,'Acceptance assumed a fill';
 s:=public.journal_signal_execution((s->>'id')::uuid,100,now());
 assert (s->>'execution_confirmed')::boolean,'Explicit execution not saved';
 select id into a from public.signal_alerts where signal_id=(s->>'id')::uuid and kind='entry_watch';
 assert public.journal_alert_change(a,true,101)->>'trigger_price'='101','Watch edit failed';
 begin update public.market_signals set outcome='win'; raise exception 'Customer fabricated outcome'; exception when insufficient_privilege then null; end;
 begin perform public.journal_monitor_signal((s->>'id')::uuid,'{}'); raise exception 'Customer invoked trusted monitor'; exception when insufficient_privilege then null; end;
end $$;

set local role service_role;
do $$ declare s public.market_signals; a public.signal_alerts; data jsonb; begin
 select * into s from public.market_signals where user_id='d0b10000-0000-4000-a000-000000000001';
 select * into a from public.signal_alerts where signal_id=s.id and kind='entry_watch';
 data:=jsonb_build_object('status','active','outcome',null,'execution_timestamp',s.executed_at,'events',jsonb_build_array(jsonb_build_object('alert_id',a.id,'kind',a.kind,'timestamp',now(),'price',101,'explanation','Synthetic closed-bar watch touch')));
 perform public.journal_monitor_signal(s.id,data);
 perform public.journal_monitor_signal(s.id,data);
 assert (select count(*) from public.signal_notifications where signal_id=s.id)=1,'Duplicate notification';
end $$;

set local role authenticated;
select set_config('request.jwt.claim.sub','d0b10000-0000-4000-a000-000000000002',true);
do $$ begin
 assert (select count(*) from public.market_signals)=0,'Foreign signal disclosed';
 assert (select count(*) from public.signal_alerts)=0,'Foreign alerts disclosed';
 assert (select count(*) from public.signal_notifications)=0,'Foreign notification disclosed';
 assert public.journal_market_preference() is null,'Foreign preference leaked';
 begin perform public.journal_signal_action('d0b10000-0000-4000-a000-000000000011','BUY','watch'); raise exception 'Foreign signal accepted'; exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claim.sub','d0b10000-0000-4000-a000-000000000001',true);
do $$ declare n uuid; begin
 select id into n from public.signal_notifications limit 1;
 assert public.journal_notification_read(n),'Owned notification read failed';
 assert (select read_at is not null from public.signal_notifications where id=n),'Read state not saved';
end $$;
rollback;
