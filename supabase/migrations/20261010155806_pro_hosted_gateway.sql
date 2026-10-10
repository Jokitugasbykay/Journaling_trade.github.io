create or replace function journal_private.user_access(p_user_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare s journal_private.subscriptions; u journal_private.usage_periods; a timestamptz; b timestamptz; m integer; tier text:='free';
begin
 if p_user_id is null then raise exception 'Authentication required' using errcode='28000'; end if;
 if journal_private.is_founder(p_user_id) then
  a:=date_trunc('month',now() at time zone 'UTC') at time zone 'UTC'; b:=a+interval '1 month';
  select * into u from journal_private.usage_periods where user_id=p_user_id and starts_at=a;
  return jsonb_build_object('plan','pro','founder',true,'countries','[]'::jsonb,
   'effectiveUntil','9999-12-31 23:59:59+00'::timestamptz,'periodStart',a,'periodEnd',b,
   'aiLimit',30,'aiUsed',coalesce(u.used,0),'aiReserved',coalesce(u.reserved,0),
   'aiRemaining',30-coalesce(u.used,0)-coalesce(u.reserved,0));
 end if;
 select * into s from journal_private.subscriptions where user_id=p_user_id;
 if found and s.status in ('active','trialing','cancelling') and s.period_start<=now() and s.period_end>now() then
  tier:=s.plan;
  if s.billing_interval='year' then
   for m in 0..12 loop
    if s.period_start+make_interval(months=>m)<=now() then
     a:=s.period_start+make_interval(months=>m); b:=least(s.period_start+make_interval(months=>m+1),s.period_end);
    else exit; end if;
   end loop;
  else a:=s.period_start; b:=s.period_end; end if;
  select * into u from journal_private.usage_periods where user_id=p_user_id and starts_at=a;
 end if;
 return jsonb_build_object('plan',tier,'countries',case when tier='plus' then to_jsonb(s.countries) else '[]'::jsonb end,
  'effectiveUntil',case when tier<>'free' then s.period_end else null end,'periodStart',a,'periodEnd',b,
  'aiLimit',case when tier='pro' then 30 else 0 end,'aiUsed',coalesce(u.used,0),
  'aiReserved',coalesce(u.reserved,0),'aiRemaining',case when tier='pro' then 30-coalesce(u.used,0)-coalesce(u.reserved,0) else 0 end);
end $$;

create or replace function journal_private.is_pro() returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and journal_private.user_access(auth.uid())->>'plan'='pro';
$$;
create or replace function public.journal_founder_entitlements() returns jsonb language sql security invoker set search_path='' as $$
 select journal_private.own_access();
$$;

create or replace function journal_private.edge_overview(p_rows jsonb,p_initial numeric,p_currency text) returns jsonb
language plpgsql immutable set search_path='' as $$
declare r jsonb; n int:=jsonb_array_length(p_rows); total numeric:=0; gross_win numeric:=0; gross_loss numeric:=0;
 wins int:=0; losses int:=0; rr_total numeric:=0; rr_n int:=0; balance numeric:=p_initial; peak numeric:=p_initial;
 dd numeric:=0; max_dd numeric:=0; max_percent numeric:=case when p_initial>0 then 0 else null end; curve jsonb:='[]'; groups jsonb:='{}'; entries jsonb; key text; item jsonb;
begin
 for r in select value from jsonb_array_elements(p_rows) loop
  total:=total+(r->>'net_pnl')::numeric; balance:=balance+(r->>'net_pnl')::numeric; peak:=greatest(peak,balance);
  dd:=peak-balance; max_dd:=greatest(max_dd,dd);
  if peak>0 then max_percent:=greatest(coalesce(max_percent,0),dd/peak*100); end if;
  if (r->>'net_pnl')::numeric>0 then wins:=wins+1; gross_win:=gross_win+(r->>'net_pnl')::numeric;
  elsif (r->>'net_pnl')::numeric<0 then losses:=losses+1; gross_loss:=gross_loss-(r->>'net_pnl')::numeric; end if;
  if r->>'rr' is not null then rr_total:=rr_total+(r->>'rr')::numeric; rr_n:=rr_n+1; end if;
  curve:=curve||jsonb_build_array(jsonb_build_object('date',r->>'moment','trade_id',r->>'id','pnl',r->'net_pnl','equity',balance,'drawdown',dd));
 end loop;
 foreach key in array array['instrument','strategy','weekday','hour','session'] loop
  select coalesce(jsonb_agg(v),'[]') into entries from (
   select jsonb_build_object('label',x.value->>key,'id',case when key='strategy' then min(x.value->>'strategy_id') else null end,
    'trade_count',count(*),'net_pnl',sum((x.value->>'net_pnl')::numeric),
    'win_rate',count(*) filter(where (x.value->>'net_pnl')::numeric>0)::numeric*100/nullif(count(*),0),
    'trade_ids',jsonb_agg(x.value->>'id')) as v from jsonb_array_elements(p_rows) x group by x.value->>key order by x.value->>key
  ) grouped;
  groups:=groups||jsonb_build_object(key,entries);
 end loop;
 return jsonb_build_object('metrics',jsonb_build_object('expectancy',total/nullif(n,0),'profit_factor',gross_win/nullif(gross_loss,0),
  'maximum_drawdown',max_dd,'maximum_drawdown_percent',max_percent,'consistency',(select stddev_pop((value->>'net_pnl')::numeric) from jsonb_array_elements(p_rows) having count(*)>1),'average_risk_reward',rr_total/nullif(rr_n,0),'trade_count',n,'net_pnl',total,
  'win_rate',wins::numeric*100/nullif(n,0),'average_win',gross_win/nullif(wins,0),'average_loss',-gross_loss/nullif(losses,0)),
  'equity',curve,'groups',groups,'distribution',jsonb_build_object('wins',wins,'losses',losses,'breakeven',n-wins-losses),'currency',p_currency);
end $$;
revoke all on function journal_private.edge_overview(jsonb,numeric,text) from public,anon,authenticated;
grant execute on function journal_private.edge_overview(jsonb,numeric,text) to authenticated;

create or replace function public.journal_edge_analytics(p_filters jsonb default '{}') returns jsonb
language plpgsql security invoker set search_path='' as $$
declare uid uuid:=auth.uid(); tz text:=coalesce(p_filters->>'tz','UTC'); aid uuid:=nullif(p_filters->>'account_id','')::uuid;
 sid uuid:=nullif(p_filters->>'strategy_id','')::uuid; first date:=nullif(p_filters->>'start','')::date;
 last date:=nullif(p_filters->>'end','')::date; yr int:=coalesce((p_filters->>'year')::int,extract(year from now())::int);
 initial numeric; curr text; currencies int; rows jsonb; overview jsonb; heat jsonb; risk jsonb; rules jsonb; violations jsonb:='[]';
 r jsonb; rule jsonb; observed numeric; day date; days jsonb; monthly jsonb; hourly jsonb; sessions jsonb; exposure numeric;
 daily numeric; weekly numeric; unknown int; checks jsonb:='[]'; year_rows jsonb; warnings jsonb:='[]';
begin
 if uid is null or not journal_private.is_pro() then raise exception 'Active Pro required' using errcode='42501'; end if;
 if not exists(select 1 from pg_timezone_names where name=tz) or first>last or yr not between 1900 and 2200
 then raise exception 'Invalid timezone, dates or year' using errcode='22023'; end if;
 if aid is not null and not exists(select 1 from public.trading_accounts where id=aid and user_id=uid)
 or sid is not null and not exists(select 1 from public.strategies where id=sid and user_id=uid)
 then raise exception 'Account or strategy not found' using errcode='42501'; end if;
 select coalesce(sum(initial_balance),0),min(currency),count(distinct currency) into initial,curr,currencies
 from public.trading_accounts where user_id=uid and (aid is null or id=aid);
 if currencies>1 then raise exception 'Select one account before combining different currencies' using errcode='22023'; end if;
 select coalesce(jsonb_agg(x order by x->>'moment',x->>'id'),'[]') into rows from (
 select jsonb_build_object('id',t.id,'strategy_id',t.strategy_id,'net_pnl',case when t.pnl_is_net then t.pnl else t.pnl-t.fees-t.commission-t.spread_cost-t.slippage_cost-t.swap-t.financing_fee end,
  'moment',coalesce(t.closed_at,t.opened_at),'date',(coalesce(t.closed_at,t.opened_at) at time zone tz)::date,
  'instrument',t.symbol,'strategy',coalesce(s.name,'Unassigned'),'weekday',trim(to_char(coalesce(t.closed_at,t.opened_at) at time zone tz,'Day')),
  'hour',extract(hour from coalesce(t.closed_at,t.opened_at) at time zone tz),'risk_percent',t.risk_percent,
  'session',case
   when extract(isodow from coalesce(t.closed_at,t.opened_at) at time zone 'America/New_York')<6 and (coalesce(t.closed_at,t.opened_at) at time zone 'America/New_York')::time>='09:30' and (coalesce(t.closed_at,t.opened_at) at time zone 'America/New_York')::time<'16:00' then 'New York'
   when extract(isodow from coalesce(t.closed_at,t.opened_at) at time zone 'Europe/London')<6 and (coalesce(t.closed_at,t.opened_at) at time zone 'Europe/London')::time>='08:00' and (coalesce(t.closed_at,t.opened_at) at time zone 'Europe/London')::time<'16:30' then 'London'
   when extract(isodow from coalesce(t.closed_at,t.opened_at) at time zone 'Asia/Tokyo')<6 and (coalesce(t.closed_at,t.opened_at) at time zone 'Asia/Tokyo')::time>='09:00' and (coalesce(t.closed_at,t.opened_at) at time zone 'Asia/Tokyo')::time<'15:00' then 'Asia' else 'Outside sessions' end,
  'rr',abs((t.take_profit-t.entry_price)/nullif(t.entry_price-t.stop_loss,0))) x
 from public.trades t left join public.strategies s on s.id=t.strategy_id and s.user_id=uid
 where t.user_id=uid and (aid is null or t.account_id=aid) and (sid is null or t.strategy_id=sid) and t.status='closed'
 and t.pnl is not null and coalesce(t.closed_at,t.opened_at) is not null
 and (first is null or (coalesce(t.closed_at,t.opened_at) at time zone tz)::date>=first)
 and (last is null or (coalesce(t.closed_at,t.opened_at) at time zone tz)::date<=last)) dataset;
 if first is not null then
  select initial+coalesce(sum(case when pnl_is_net then pnl else pnl-fees-commission-spread_cost-slippage_cost-swap-financing_fee end),0) into initial
  from public.trades where user_id=uid and (aid is null or account_id=aid) and status='closed' and (coalesce(closed_at,opened_at) at time zone tz)::date<first;
 end if;
 if exists(select 1 from public.trades where user_id=uid and (aid is null or account_id=aid) and status='closed' and (pnl is null or coalesce(closed_at,opened_at) is null))
 then warnings:=warnings||jsonb_build_array('Trades without reported PnL or timestamps are excluded; complete their records to include them.'); end if;
 if exists(select 1 from public.trades where user_id=uid and (aid is null or account_id=aid) and status='closed' and closed_at is null)
 then warnings:=warnings||jsonb_build_array('Some trades have no close timestamp; their recorded opening timestamp is used.'); end if;
 overview:=journal_private.edge_overview(rows,initial,coalesce(curr,'UNKNOWN'))||jsonb_build_object('warnings',warnings);
 select coalesce(jsonb_agg(jsonb_build_object('date',d,'pnl',coalesce(a.pnl,0),'trade_count',coalesce(a.n,0),'trade_ids',coalesce(a.ids,'[]'),
  'state',case when a.n is null then 'no_activity' when a.pnl>0 then 'positive' when a.pnl<0 then 'negative' else 'zero' end) order by d),'[]') into days
 from (select generate_series(make_date(yr,1,1)::timestamp,make_date(yr,12,31)::timestamp,interval '1 day')::date d) dates
 left join (select (value->>'date')::date as activity_date,sum((value->>'net_pnl')::numeric) pnl,count(*) n,jsonb_agg(value->>'id') ids from jsonb_array_elements(rows) group by (value->>'date')::date) a on a.activity_date=d;
 select coalesce(jsonb_agg(jsonb_build_object('label',label,'trade_count',n,'net_pnl',pnl,'win_rate',wins*100/n,'trade_ids',ids)),'[]') into monthly from
 (select to_char((value->>'date')::date,'YYYY-MM') label,count(*) n,sum((value->>'net_pnl')::numeric) pnl,
 count(*) filter(where (value->>'net_pnl')::numeric>0)::numeric wins,jsonb_agg(value->>'id') ids from jsonb_array_elements(rows) where extract(year from (value->>'date')::date)=yr group by 1 order by 1) months;
 select coalesce(jsonb_agg(value),'[]') into year_rows from jsonb_array_elements(rows) where extract(year from (value->>'date')::date)=yr;
 heat:=jsonb_build_object('days',days,'months',monthly,'hours',journal_private.edge_overview(year_rows,initial,curr)->'groups'->'hour','sessions',journal_private.edge_overview(year_rows,initial,curr)->'groups'->'session','warnings',warnings);
 select coalesce(jsonb_agg(to_jsonb(x)),'[]') into rules from public.risk_rules x where user_id=uid;
 for rule in select value from jsonb_array_elements(rules) where (value->>'enabled')::boolean loop
  for r in select value from jsonb_array_elements(rows) loop
   day:=(r->>'date')::date;
   if rule->>'kind'='max_risk_percent' then observed:=(r->>'risk_percent')::numeric;
   elsif rule->>'kind'='max_trades_per_day' then select count(*) into observed from jsonb_array_elements(rows) where value->>'date'=r->>'date' and (value->>'moment',value->>'id')<=(r->>'moment',r->>'id');
   else select greatest(0,-coalesce(sum((value->>'net_pnl')::numeric),0)) into observed from jsonb_array_elements(rows)
    where (value->>'moment',value->>'id')<=(r->>'moment',r->>'id') and case when rule->>'kind'='max_daily_loss' then value->>'date'=r->>'date' else date_trunc('week',(value->>'date')::date)=date_trunc('week',day) end; end if;
   if observed is not null then checks:=checks||jsonb_build_array(jsonb_build_object('date',day)); end if;
   if observed>(rule->>'threshold')::numeric then violations:=violations||jsonb_build_array(jsonb_build_object('trade_id',r->>'id','rule_id',rule->>'id','date',day,'observed',observed,'threshold',rule->'threshold','kind',rule->>'kind')); end if;
  end loop;
 end loop;
 select coalesce(sum(risk_amount),0),count(*) filter(where risk_amount is null),
  coalesce(sum(risk_amount) filter(where (opened_at at time zone tz)::date=(now() at time zone tz)::date),0),
  coalesce(sum(risk_amount) filter(where date_trunc('week',opened_at at time zone tz)=date_trunc('week',now() at time zone tz)),0)
 into exposure,unknown,daily,weekly from public.trades where user_id=uid and (aid is null or account_id=aid) and status='open';
 risk:=jsonb_build_object('overview',jsonb_build_object('risk_per_trade',(select avg((value->>'risk_percent')::numeric) from jsonb_array_elements(rows)),
 'open_exposure',case when unknown=0 then exposure else null end,'daily_exposure',case when unknown=0 then daily else null end,'weekly_exposure',case when unknown=0 then weekly else null end,'unknown_positions',unknown),
 'rules',rules,'violations',violations,'compliance',(select coalesce(jsonb_agg(jsonb_build_object('date',d,'checked',n,'violations',v)),'[]') from
 (select d,n,(select count(*) from jsonb_array_elements(violations) z where z.value->>'date'=q.d) v from (select value->>'date' d,count(*) n from jsonb_array_elements(checks) group by 1) q) c),
 'warnings',warnings||jsonb_build_array('Open positions without recorded risk amounts have unknown exposure.'));
 return jsonb_build_object('overview',overview,'heatmap',heat,'risk',risk);
end $$;
revoke all on function public.journal_edge_analytics(jsonb) from public,anon;
grant execute on function public.journal_edge_analytics(jsonb) to authenticated;

create or replace function public.journal_edge_position(p_inputs jsonb) returns jsonb language plpgsql security invoker set search_path='' as $$
declare balance numeric:=(p_inputs->>'balance')::numeric; risk numeric:=(p_inputs->>'risk_percent')::numeric;
 entry numeric:=(p_inputs->>'entry')::numeric; stop numeric:=(p_inputs->>'stop')::numeric; contract numeric:=(p_inputs->>'contract_size')::numeric;
 step numeric:=(p_inputs->>'quantity_step')::numeric; fx numeric:=(p_inputs->>'quote_to_account_rate')::numeric; budget numeric; unit numeric; qty numeric;
begin
 if auth.uid() is null or not journal_private.is_pro() then raise exception 'Active Pro required' using errcode='42501'; end if;
 if balance is null or risk is null or entry is null or stop is null or contract is null or step is null or fx is null
 or least(balance,risk,entry,stop,contract,step,fx)<=0 or greatest(balance,risk,entry,stop,contract,step,fx)>=1e24
 or risk>100 or entry=stop or balance::text='NaN' or risk::text='NaN' or entry::text='NaN' or stop::text='NaN' or contract::text='NaN' or step::text='NaN' or fx::text='NaN'
 then raise exception 'Positive values and explicit contract/FX specifications are required' using errcode='22023'; end if;
 budget:=balance*risk/100; unit:=abs(entry-stop)*contract*fx; qty:=floor(budget/unit/step)*step;
 if qty<=0 then raise exception 'Risk budget is smaller than the minimum quantity step' using errcode='22023'; end if;
 return jsonb_build_object('quantity',qty,'risk_budget',budget,'estimated_loss',qty*unit,'assumptions',jsonb_build_object('fees_included',false,'slippage_included',false,'contract_size',contract,'quantity_step',step,'quote_to_account_rate',fx));
end $$;
revoke all on function public.journal_edge_position(jsonb) from public,anon;
grant execute on function public.journal_edge_position(jsonb) to authenticated;

create or replace function public.journal_edge_review(p_config jsonb) returns jsonb language plpgsql security invoker set search_path='' as $$
declare d date:=coalesce((p_config->>'start')::date,current_date); finish date; previous date; review_kind text:=coalesce(p_config->>'period','weekly'); current_data jsonb; prior_data jsonb; saved public.performance_reviews;
begin
 if auth.uid() is null or not journal_private.is_pro() then raise exception 'Active Pro required' using errcode='42501'; end if;
 if review_kind not in ('weekly','monthly') then raise exception 'Invalid review period' using errcode='22023'; end if;
 d:=date_trunc(case when review_kind='weekly' then 'week' else 'month' end,d)::date;
 finish:=d+case when review_kind='weekly' then interval '7 days' else interval '1 month' end-interval '1 day';
 previous:=d-case when review_kind='weekly' then interval '7 days' else interval '1 month' end;
 current_data:=public.journal_edge_analytics(p_config||jsonb_build_object('start',d,'end',finish));
 prior_data:=public.journal_edge_analytics(p_config||jsonb_build_object('start',previous,'end',d-1));
 insert into public.performance_reviews(user_id,account_id,period,period_start,timezone,summary)
 values(auth.uid(),nullif(p_config->>'account_id','')::uuid,review_kind,d,coalesce(p_config->>'tz','UTC'),
 jsonb_build_object('performance',current_data->'overview','previous_period',prior_data->'overview','risk',current_data->'risk',
 'evidence_ids',(select coalesce(jsonb_agg(value->>'trade_id'),'[]') from jsonb_array_elements(current_data->'overview'->'equity'))))
 on conflict(user_id,account_id,period,period_start,timezone) do update set summary=excluded.summary returning * into saved;
 return jsonb_build_object('id',saved.id,'kind','review','state','succeeded','result',saved.summary);
end $$;
revoke all on function public.journal_edge_review(jsonb) from public,anon;
grant execute on function public.journal_edge_review(jsonb) to authenticated;

create or replace function public.journal_edge_claim_report(p_id uuid,p_worker uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare j public.platform_jobs;
begin
 if p_worker is null then raise exception 'Worker required' using errcode='22023'; end if;
 select * into j from public.platform_jobs where id=p_id and kind='report';
 if not found then return null; end if;
 perform pg_advisory_xact_lock(hashtextextended(j.user_id::text,0));
 update public.platform_jobs set status='running',worker_id=p_worker,lease_until=now()+interval '2 minutes'
 where id=p_id and kind='report' and status='queued' and deleted_at is null returning * into j;
 return case when found then to_jsonb(j) else null end;
end $$;
revoke all on function public.journal_edge_claim_report(uuid,uuid) from public,anon,authenticated;
grant execute on function public.journal_edge_claim_report(uuid,uuid) to service_role;
