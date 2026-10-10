begin;
insert into auth.users(id,email,email_confirmed_at) values
 ('acb10000-0000-4000-a000-000000000001','gamingyoga14@gmail.com',now()),
 ('acb10000-0000-4000-a000-000000000002','gateway-b@example.invalid',now());
insert into public.trading_accounts(id,user_id,name,initial_balance) values
 ('acb10000-0000-4000-a000-000000000011','acb10000-0000-4000-a000-000000000001','Gateway A',100),
 ('acb10000-0000-4000-a000-000000000012','acb10000-0000-4000-a000-000000000002','Gateway B',100);
insert into public.trades(id,user_id,account_id,symbol,side,pnl,closed_at,risk_percent,entry_price,stop_loss,take_profit) values
 ('acb10000-0000-4000-a000-000000000021','acb10000-0000-4000-a000-000000000001','acb10000-0000-4000-a000-000000000011','EURUSD','long',20,'2026-10-01T23:30:00Z',1,10,9,12),
 ('acb10000-0000-4000-a000-000000000022','acb10000-0000-4000-a000-000000000001','acb10000-0000-4000-a000-000000000011','EURUSD','long',-10,'2026-10-02T23:30:00Z',3,10,9,12),
 ('acb10000-0000-4000-a000-000000000023','acb10000-0000-4000-a000-000000000002','acb10000-0000-4000-a000-000000000012','XAUUSD','long',999,'2026-10-02T23:30:00Z',1,10,9,12);
set local role authenticated;
select set_config('request.jwt.claim.sub','acb10000-0000-4000-a000-000000000001',true);
insert into public.risk_rules(user_id,name,kind,threshold) values(auth.uid(),'Risk','max_risk_percent',2);
do $$ declare a jsonb; x jsonb; y jsonb; n int; begin
 assert public.journal_entitlements()->>'plan'='pro','Verified Founder denied';
 a:=public.journal_edge_analytics('{"tz":"Asia/Jakarta","year":2026}');
 assert a->'overview'->'metrics'->>'expectancy'='5.0000000000000000','Expectancy';
 assert (a->'overview'->'metrics'->>'profit_factor')::numeric=2,'Profit factor';
 assert (a->'overview'->'metrics'->>'maximum_drawdown')::numeric=10,'Drawdown';
 assert (a->'overview'->'metrics'->>'win_rate')::numeric=50,'Percentage scale';
 assert (a->'overview'->'metrics'->>'average_risk_reward')::numeric=2,'RR';
 assert jsonb_array_length(a->'overview'->'equity')=2,'Cross-user trade leak';
 assert a->'overview'->'equity'->1->>'equity'='110.0000','Equity';
 assert jsonb_array_length(a->'heatmap'->'days')=365,'Calendar completeness';
 select value into x from jsonb_array_elements(a->'heatmap'->'days') where value->>'date'='2026-10-02';
 assert x->>'state'='positive' and (x->>'pnl')::numeric=20,'Timezone aggregation';
 select value into x from jsonb_array_elements(a->'heatmap'->'days') where value->>'date'='2026-10-01';
 assert x->>'state'='no_activity','Empty day distinction';
 assert jsonb_array_length(a->'risk'->'violations')=1,'Risk violation';
 assert (a->'risk'->'compliance'->0->>'checked')::int=1,'Actual rule checks';
 assert jsonb_array_length(public.journal_edge_analytics('{"year":2025}')->'heatmap'->'hours')=0,'Year filter';
 x:=public.journal_edge_position('{"balance":1000,"risk_percent":1,"entry":10,"stop":9,"contract_size":1,"quantity_step":0.1,"quote_to_account_rate":1}');
 assert (x->>'quantity')::numeric=10 and (x->>'estimated_loss')::numeric=10,'Position sizing';
 begin perform public.journal_edge_position('{"balance":1000,"risk_percent":1,"entry":10,"stop":10}');raise exception 'Invalid sizing accepted';exception when invalid_parameter_value then null;end;
 begin perform public.journal_edge_analytics('{"account_id":"acb10000-0000-4000-a000-000000000012"}');raise exception 'Foreign account accepted';exception when insufficient_privilege then null;end;
 x:=public.journal_edge_review('{"start":"2026-10-01","period":"monthly"}');
 y:=public.journal_edge_review('{"start":"2026-10-02","period":"monthly"}');
 assert x->>'id'=y->>'id','Duplicate review';
 assert not has_function_privilege('authenticated','public.journal_edge_claim_report(uuid,uuid)','EXECUTE'),'User report completion';
 for n in 1..30 loop perform public.journal_create_job('journal',jsonb_build_object('n',n),gen_random_uuid(),repeat('a',64));end loop;
 assert (public.journal_founder_entitlements()->>'aiRemaining')::int=0,'Founder quota reservation';
 begin perform public.journal_create_job('journal','{}',gen_random_uuid(),repeat('b',64));raise exception 'Quota bypass';exception when raise_exception then assert sqlerrm='AI allowance exhausted';end;
end $$;
select set_config('request.jwt.claim.sub','acb10000-0000-4000-a000-000000000002',true);
do $$ begin
 assert public.journal_entitlements()->>'plan'='free','Ordinary user granted Pro';
 begin perform public.journal_edge_analytics();raise exception 'Free analytics allowed';exception when insufficient_privilege then null;end;
end $$;
reset role;
update auth.users set email_confirmed_at=null where id='acb10000-0000-4000-a000-000000000001';
set local role authenticated;
select set_config('request.jwt.claim.sub','acb10000-0000-4000-a000-000000000001',true);
do $$ begin assert public.journal_entitlements()->>'plan'='free','Unverified Founder granted Pro';end $$;
rollback;
