create table public.market_preferences (
 user_id uuid primary key references auth.users(id) on delete cascade,
 trading_style text not null check(trading_style in ('SCALPING','INTRADAY','SWING')),
 browser_notifications boolean not null default false,
 updated_at timestamptz not null default now()
);
alter table public.market_preferences enable row level security;
revoke all on public.market_preferences from anon,authenticated;
grant select on public.market_preferences to authenticated;
create policy market_preferences_owner on public.market_preferences for select to authenticated using(user_id=(select auth.uid()));

create function journal_private.market_preference(p_style text default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); result jsonb;
begin
 if uid is null or journal_private.user_access(uid)->>'plan'<>'pro' then raise exception 'Active Pro required' using errcode='42501'; end if;
 if p_style is not null then
  if p_style not in ('SCALPING','INTRADAY','SWING') then raise exception 'Invalid trading style' using errcode='22023'; end if;
  insert into public.market_preferences(user_id,trading_style) values(uid,p_style)
  on conflict(user_id) do update set trading_style=excluded.trading_style,updated_at=now();
 end if;
 select to_jsonb(p) into result from public.market_preferences p where user_id=uid;
 return result;
end $$;
create function public.journal_market_preference(p_style text default null) returns jsonb
language sql security invoker set search_path='' as $$ select journal_private.market_preference(p_style); $$;
revoke all on function journal_private.market_preference(text),public.journal_market_preference(text) from public,anon;
grant execute on function journal_private.market_preference(text),public.journal_market_preference(text) to authenticated;

create function journal_private.notification_preference(p_enabled boolean) returns jsonb language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); result jsonb;
begin
 if uid is null or journal_private.user_access(uid)->>'plan'<>'pro' then raise exception 'Active Pro required' using errcode='42501'; end if;
 update public.market_preferences set browser_notifications=p_enabled,updated_at=now() where user_id=uid returning to_jsonb(market_preferences) into result;
 if not found then raise exception 'Save a trading style first' using errcode='22023'; end if;
 return result;
end $$;
create function public.journal_notification_preference(p_enabled boolean) returns jsonb language sql security invoker set search_path='' as $$ select journal_private.notification_preference(p_enabled); $$;
revoke all on function journal_private.notification_preference(boolean),public.journal_notification_preference(boolean) from public,anon;
grant execute on function journal_private.notification_preference(boolean),public.journal_notification_preference(boolean) to authenticated;


-- Old queued requests cannot bypass mandatory style selection through direct RPC calls.
create function journal_private.check_market_style() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.kind='market' and new.status='queued' and not exists(
  select 1 from public.market_preferences p where p.user_id=new.user_id and p.trading_style=new.payload->>'trading_style'
 ) then raise exception 'Select and save a trading style' using errcode='22023'; end if;
 return new;
end $$;
revoke all on function journal_private.check_market_style() from public,anon,authenticated;
create trigger market_job_style before insert on public.platform_jobs for each row execute function journal_private.check_market_style();

create table public.market_signals (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 job_id uuid not null references public.platform_jobs(id), direction text not null check(direction in ('BUY','SELL')),
 instrument text not null, timeframe text not null, trading_style text not null check(trading_style in ('SCALPING','INTRADAY','SWING')),
 entry numeric not null check(entry>0), stop_loss numeric not null check(stop_loss>0), take_profit numeric not null check(take_profit>0),
 risk_reward numeric not null check(risk_reward>0), analyzed_at timestamptz not null, expires_at timestamptz not null,
 action text not null check(action in ('watch','take','dismiss')), accepted_at timestamptz, mode text check(mode in ('actual','paper')),
 execution_confirmed boolean not null default false, executed_at timestamptz, execution_price numeric check(execution_price>0),
 monitored_through timestamptz, coverage_complete boolean not null default true,
 outcome text check(outcome in ('win','loss','breakeven','AMBIGUOUS')), outcome_at timestamptz,
 status text not null default 'active' check(status in ('active','invalidated','expired','closed')),
 model_version jsonb not null, fundamental_events jsonb not null default '[]', created_at timestamptz not null default now(), unique(user_id,job_id,direction),
 check(expires_at>analyzed_at), check(not execution_confirmed or (mode is not null and executed_at is not null and execution_price is not null)),
 check((direction='BUY' and stop_loss<entry and entry<take_profit) or (direction='SELL' and take_profit<entry and entry<stop_loss))
);
create index market_signals_active on public.market_signals(status,created_at) where status='active';
create table public.signal_alerts (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 signal_id uuid not null references public.market_signals(id) on delete cascade,
 kind text not null check(kind in ('entry_watch','entry_confirmed','stop_loss','take_profit_1','invalidated','expired','fundamental')),
 trigger_price numeric check(trigger_price>0), enabled boolean not null default true,
 triggered_at timestamptz, created_at timestamptz not null default now(), unique(signal_id,kind)
);
create table public.signal_notifications (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 signal_id uuid not null references public.market_signals(id) on delete cascade,
 alert_id uuid references public.signal_alerts(id) on delete cascade,
 deduplication_key text not null unique, alert_type text not null,
 instrument text not null, trading_style text not null, direction text not null,
 trigger_price numeric, trigger_timestamp timestamptz not null, explanation text not null,
 read_at timestamptz, delivery_status text not null default 'in_app', created_at timestamptz not null default now()
);
create index signal_alerts_owner on public.signal_alerts(user_id,created_at desc);
create index signal_notifications_owner on public.signal_notifications(user_id,created_at desc);
alter table public.market_signals enable row level security;
alter table public.signal_alerts enable row level security;
alter table public.signal_notifications enable row level security;
revoke all on public.market_signals,public.signal_alerts,public.signal_notifications from anon,authenticated;
grant select on public.market_signals,public.signal_alerts,public.signal_notifications to authenticated;
grant all on public.market_preferences,public.market_signals,public.signal_alerts,public.signal_notifications to service_role;
create policy market_signals_owner on public.market_signals for select to authenticated using(user_id=(select auth.uid()));
create policy signal_alerts_owner on public.signal_alerts for select to authenticated using(user_id=(select auth.uid()));
create policy signal_notifications_owner on public.signal_notifications for select to authenticated using(user_id=(select auth.uid()));

create function journal_private.signal_action(p_job_id uuid,p_direction text,p_action text,p_mode text default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); j public.platform_jobs; scenario jsonb; s public.market_signals; ctx jsonb;
begin
 if uid is null or journal_private.user_access(uid)->>'plan'<>'pro' then raise exception 'Active Pro required' using errcode='42501'; end if;
 if p_direction not in ('BUY','SELL') or p_action not in ('watch','take','dismiss') or (p_action='take' and (p_mode is null or p_mode not in ('actual','paper'))) then
  raise exception 'Invalid acceptance action' using errcode='22023'; end if;
 select * into j from public.platform_jobs where id=p_job_id and user_id=uid and kind='market' and status='succeeded';
 if not found then raise exception 'Analysis not found' using errcode='42501'; end if;
 ctx:=j.result->'quantitative'->'market';
 select value into scenario from jsonb_array_elements(ctx->'intelligence'->'scenarios') where value->>'direction'=p_direction;
 if scenario is null or scenario->>'entry' is null or (p_action='take' and scenario->>'setup_status'<>'CONFIRMED') then raise exception 'No eligible scenario; take requires confirmation' using errcode='22023'; end if;
 if p_action<>'dismiss' and ((ctx->>'valid_until')::timestamptz<=now() or not exists(select 1 from public.market_preferences where user_id=uid and trading_style=scenario->>'trading_style')) then
  raise exception 'Signal expired or trading style changed' using errcode='22023'; end if;
 select * into s from public.market_signals where user_id=uid and job_id=j.id and direction=p_direction for update;
 if found and p_action<>'dismiss' and s.status<>'active' then raise exception 'Signal is no longer active' using errcode='22023'; end if;
 insert into public.market_signals(user_id,job_id,direction,instrument,timeframe,trading_style,entry,stop_loss,take_profit,risk_reward,analyzed_at,expires_at,action,accepted_at,mode,model_version,fundamental_events)
 values(uid,j.id,p_direction,ctx->>'instrument',ctx->>'timeframe',scenario->>'trading_style',(scenario->>'entry')::numeric,
 (scenario->>'stop_loss')::numeric,(scenario->>'take_profit_1')::numeric,(scenario->>'risk_reward')::numeric,
 (scenario->>'timestamp')::timestamptz,(ctx->>'valid_until')::timestamptz,p_action,case when p_action='take' then now() end,p_mode,j.result->'model_version',ctx->'intelligence'->'fundamental'->'events')
 on conflict(user_id,job_id,direction) do update set action=excluded.action,accepted_at=coalesce(market_signals.accepted_at,excluded.accepted_at),mode=case when market_signals.execution_confirmed then market_signals.mode else coalesce(excluded.mode,market_signals.mode) end
 returning * into s;
 if p_action='dismiss' then update public.signal_alerts set enabled=false where signal_id=s.id;
 else
  insert into public.signal_alerts(user_id,signal_id,kind,trigger_price)
  values(uid,s.id,'entry_watch',s.entry),(uid,s.id,'entry_confirmed',s.entry),(uid,s.id,'stop_loss',s.stop_loss),(uid,s.id,'take_profit_1',s.take_profit),(uid,s.id,'expired',null),(uid,s.id,'invalidated',null),(uid,s.id,'fundamental',null)
  on conflict(signal_id,kind) do nothing;
 end if;
 return to_jsonb(s);
end $$;
create function public.journal_signal_action(p_job_id uuid,p_direction text,p_action text,p_mode text default null) returns jsonb
language sql security invoker set search_path='' as $$ select journal_private.signal_action(p_job_id,p_direction,p_action,p_mode); $$;
revoke all on function journal_private.signal_action(uuid,text,text,text),public.journal_signal_action(uuid,text,text,text) from public,anon;
grant execute on function journal_private.signal_action(uuid,text,text,text),public.journal_signal_action(uuid,text,text,text) to authenticated;

create function journal_private.signal_execution(p_id uuid,p_price numeric,p_at timestamptz) returns jsonb
language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); s public.market_signals;
begin
 if uid is null or journal_private.user_access(uid)->>'plan'<>'pro' then raise exception 'Active Pro required' using errcode='42501'; end if;
 if p_price is null or p_price<=0 or p_price>=1e24 or p_at is null or p_at>now() then raise exception 'Invalid execution confirmation' using errcode='22023'; end if;
 select * into s from public.market_signals where id=p_id and user_id=uid for update;
 if not found or s.action<>'take' or s.status<>'active' or p_at<s.created_at then raise exception 'Accepted signal required' using errcode='22023'; end if;
 if p_at>s.expires_at or not ((s.direction='BUY' and s.stop_loss<p_price and p_price<s.take_profit) or (s.direction='SELL' and s.take_profit<p_price and p_price<s.stop_loss)) then
  raise exception 'Execution is outside the valid setup levels or validity window' using errcode='22023'; end if;
 if s.execution_confirmed then return to_jsonb(s); end if;
 update public.market_signals set execution_confirmed=true,execution_price=p_price,executed_at=p_at,monitored_through=null,coverage_complete=true where id=s.id returning * into s;
 return to_jsonb(s);
end $$;
create function public.journal_signal_execution(p_id uuid,p_price numeric,p_at timestamptz) returns jsonb
language sql security invoker set search_path='' as $$ select journal_private.signal_execution(p_id,p_price,p_at); $$;
revoke all on function journal_private.signal_execution(uuid,numeric,timestamptz),public.journal_signal_execution(uuid,numeric,timestamptz) from public,anon;
grant execute on function journal_private.signal_execution(uuid,numeric,timestamptz),public.journal_signal_execution(uuid,numeric,timestamptz) to authenticated;

create function journal_private.alert_change(p_id uuid,p_enabled boolean,p_price numeric default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); a public.signal_alerts;
begin
 if uid is null or journal_private.user_access(uid)->>'plan'<>'pro' then raise exception 'Active Pro required' using errcode='42501'; end if;
 if p_price is not null and (p_price<=0 or p_price>=1e24) then raise exception 'Invalid watch price' using errcode='22023'; end if;
 select * into a from public.signal_alerts where id=p_id and user_id=uid for update;
 if not found then raise exception 'Alert not found' using errcode='42501'; end if;
 if p_price is not null and a.kind<>'entry_watch' then raise exception 'Only watch prices are editable; structural trade levels stay unchanged' using errcode='22023'; end if;
 update public.signal_alerts set enabled=p_enabled,trigger_price=coalesce(p_price,trigger_price) where id=p_id returning * into a;
 return to_jsonb(a);
end $$;
create function public.journal_alert_change(p_id uuid,p_enabled boolean,p_price numeric default null) returns jsonb
language sql security invoker set search_path='' as $$ select journal_private.alert_change(p_id,p_enabled,p_price); $$;
revoke all on function journal_private.alert_change(uuid,boolean,numeric),public.journal_alert_change(uuid,boolean,numeric) from public,anon;
grant execute on function journal_private.alert_change(uuid,boolean,numeric),public.journal_alert_change(uuid,boolean,numeric) to authenticated;

create function journal_private.notification_read(p_id uuid) returns boolean language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or journal_private.user_access(auth.uid())->>'plan'<>'pro' then raise exception 'Active Pro required' using errcode='42501'; end if;
 update public.signal_notifications set read_at=coalesce(read_at,now()) where id=p_id and user_id=auth.uid();
 return found;
end $$;
create function public.journal_notification_read(p_id uuid) returns boolean language sql security invoker set search_path='' as $$ select journal_private.notification_read(p_id); $$;
revoke all on function journal_private.notification_read(uuid),public.journal_notification_read(uuid) from public,anon;
grant execute on function journal_private.notification_read(uuid),public.journal_notification_read(uuid) to authenticated;

create function public.journal_monitor_signal(p_id uuid,p_result jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare s public.market_signals; event jsonb; a public.signal_alerts; changed boolean;
begin
 select * into s from public.market_signals where id=p_id for update;
 if not found or s.action='dismiss' or s.status not in ('active','invalidated') then return null; end if;
 if s.executed_at is distinct from (p_result->>'execution_timestamp')::timestamptz then return null; end if;
 if journal_private.user_access(s.user_id)->>'plan'<>'pro' then raise exception 'Active Pro required' using errcode='42501'; end if;
 if p_result->>'status' not in ('active','invalidated','expired','closed') or (p_result->>'outcome' is not null and (s.mode is distinct from 'paper' or not s.execution_confirmed or p_result->>'outcome' not in ('win','loss','breakeven','AMBIGUOUS'))) then
  raise exception 'Invalid monitor result' using errcode='22023'; end if;
 for event in select value from jsonb_array_elements(p_result->'events') loop
  select * into a from public.signal_alerts where id=(event->>'alert_id')::uuid and signal_id=s.id and kind=event->>'kind' and enabled and triggered_at is null for update;
  if not found then continue; end if;
  insert into public.signal_notifications(user_id,signal_id,alert_id,deduplication_key,alert_type,instrument,trading_style,direction,trigger_price,trigger_timestamp,explanation)
  values(s.user_id,s.id,a.id,a.id::text,a.kind,s.instrument,s.trading_style,s.direction,(event->>'price')::numeric,(event->>'timestamp')::timestamptz,event->>'explanation')
  on conflict(deduplication_key) do nothing;
  update public.signal_alerts set triggered_at=(event->>'timestamp')::timestamptz where id=a.id;
 end loop;
 update public.market_signals set status=case when status='invalidated' and p_result->>'status'='active' then status else p_result->>'status' end,outcome=p_result->>'outcome',
 monitored_through=greatest((p_result->>'monitored_through')::timestamptz,monitored_through),coverage_complete=coverage_complete and coalesce((p_result->>'coverage_complete')::boolean,true),
 outcome_at=case when p_result->>'outcome' is not null then now() else null end where id=s.id returning * into s;
 return to_jsonb(s);
end $$;
revoke all on function public.journal_monitor_signal(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.journal_monitor_signal(uuid,jsonb) to service_role;

create table public.fundamental_events (
 event_id text primary key, provider text not null, evidence jsonb not null check(jsonb_typeof(evidence)='object'),
 observed_at timestamptz not null, created_at timestamptz not null default now()
);
alter table public.fundamental_events enable row level security;
revoke all on public.fundamental_events from anon,authenticated;
grant all on public.fundamental_events to service_role;
