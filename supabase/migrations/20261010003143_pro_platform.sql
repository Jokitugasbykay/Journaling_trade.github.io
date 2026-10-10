-- Additive platform migration. Existing static grants are deliberately not converted into paid subscriptions.
create schema if not exists journal_private;

create table journal_private.subscriptions (
 user_id uuid primary key references auth.users(id) on delete cascade,
 provider text not null check(length(provider) between 1 and 64),
 provider_subscription_id text not null,
 plan text not null check(plan in ('free','plus','pro')),
 status text not null check(status in ('active','trialing','cancelling','cancelled','past_due','expired')),
 billing_interval text not null check(billing_interval in ('month','year')),
 period_start timestamptz not null,
 period_end timestamptz not null check(period_end>period_start),
 countries text[] not null default '{}',
 event_at timestamptz not null,
 updated_at timestamptz not null default now(),
 unique(provider,provider_subscription_id)
);
create table journal_private.payment_events (
 provider text not null, event_id text not null, payload_hash text not null check(payload_hash ~ '^[a-f0-9]{64}$'),
 user_id uuid not null references auth.users(id) on delete cascade, occurred_at timestamptz not null,
 received_at timestamptz not null default now(), primary key(provider,event_id)
);
create table journal_private.usage_periods (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 starts_at timestamptz not null, ends_at timestamptz not null check(ends_at>starts_at),
 used integer not null default 0 check(used between 0 and 30),
 reserved integer not null default 0 check(reserved>=0 and used+reserved<=30),
 unique(user_id,starts_at)
);
create table journal_private.rate_buckets (
 user_id uuid not null references auth.users(id) on delete cascade, bucket text not null,
 starts_at timestamptz not null, requests integer not null check(requests>0), primary key(user_id,bucket)
);

create table public.platform_jobs (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 kind text not null check(kind in ('behaviour','journal','market','report','review','import')),
 status text not null default 'queued' check(status in ('queued','running','succeeded','failed','cancelled','expired')),
 idempotency_key uuid not null, payload_hash text not null check(payload_hash ~ '^[a-f0-9]{64}$'),
 payload jsonb not null check(jsonb_typeof(payload)='object' and octet_length(payload::text)<=262144),
 result jsonb, error text, deleted_at timestamptz, quota_period_id uuid references journal_private.usage_periods(id),
 worker_id uuid, lease_until timestamptz, created_at timestamptz not null default now(), finished_at timestamptz,
 unique(user_id,idempotency_key),
 check(result is null or jsonb_typeof(result)='object'),
 check((status='running')=(worker_id is not null and lease_until is not null)),
 check(status<>'succeeded' or result is not null)
);
create index platform_jobs_user_history on public.platform_jobs(user_id,created_at desc);
create index platform_jobs_queue on public.platform_jobs(created_at) where status='queued';
create index platform_jobs_expiry on public.platform_jobs(lease_until) where status='running';

create table public.risk_rules (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 name text not null check(length(name) between 1 and 160),
 kind text not null check(kind in ('max_risk_percent','max_daily_loss','max_weekly_loss','max_trades_per_day')),
 threshold numeric not null check(threshold>0 and threshold<1000000000000),
 enabled boolean not null default true, created_at timestamptz not null default now()
);
create index risk_rules_owner on public.risk_rules(user_id);
create table public.performance_reviews (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 account_id uuid references public.trading_accounts(id) on delete cascade,
 period text not null check(period in ('weekly','monthly')), period_start date not null,
 timezone text not null, summary jsonb not null check(jsonb_typeof(summary)='object'),
 created_at timestamptz not null default now(),
 unique nulls not distinct(user_id,account_id,period,period_start,timezone)
);
create index performance_reviews_owner on public.performance_reviews(user_id,period_start desc);
create table public.trade_executions (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 trade_id uuid not null references public.trades(id) on delete cascade,
 side text not null check(side in ('open','close')), quantity numeric not null check(quantity>0 and quantity<1e24),
 price numeric not null check(price>0 and price<1e24), executed_at timestamptz not null,
 commission numeric not null default 0 check(commission>=0 and commission<1e24), fx_rate numeric check(fx_rate>0 and fx_rate<1e12),
 created_at timestamptz not null default now()
);
create index trade_executions_owner on public.trade_executions(user_id,trade_id,executed_at);
alter table public.trades
 add column quote_currency text,
 add column account_currency text,
 add column contract_size numeric check(contract_size>0 and contract_size<1e24),
 add column quantity_step numeric check(quantity_step>0 and quantity_step<1e24),
 add column fx_rate numeric check(fx_rate>0 and fx_rate<1e12),
 add column commission numeric not null default 0 check(commission>=0 and commission<1e24),
 add column spread_cost numeric not null default 0 check(spread_cost>=0 and spread_cost<1e24),
 add column slippage_cost numeric not null default 0 check(slippage_cost>=0 and slippage_cost<1e24),
 add column swap numeric not null default 0 check(abs(swap)<1e24),
 add column financing_fee numeric not null default 0 check(financing_fee>=0 and financing_fee<1e24),
 add column pnl_is_net boolean not null default true;

-- Privileged implementation stays outside the exposed schema. Public functions are invoker wrappers.
create function journal_private.user_access(p_user_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare s journal_private.subscriptions; u journal_private.usage_periods; a timestamptz; b timestamptz; m integer; tier text:='free';
begin
 if p_user_id is null then raise exception 'Authentication required' using errcode='28000'; end if;
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
create function journal_private.own_access() returns jsonb language sql security definer set search_path='' as $$
 select journal_private.user_access(auth.uid());
$$;
create function public.journal_platform_access() returns jsonb language sql security invoker set search_path='' as $$
 select journal_private.own_access();
$$;
create function public.journal_entitlements() returns jsonb language sql security invoker set search_path='' as $$
 select journal_private.own_access();
$$;
create function journal_private.is_pro() returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and exists(select 1 from journal_private.subscriptions where user_id=auth.uid()
 and plan='pro' and status in ('active','trialing','cancelling') and period_start<=now() and period_end>now());
$$;
-- Preserve both legacy RPC response shapes while enforcing the new effective subscription.
create function journal_private.pro_analytics(p_feature text default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); data jsonb;
begin
 if uid is null then raise exception 'Authentication required' using errcode='28000'; end if;
 if not journal_private.is_pro() then raise exception 'Active Pro required' using errcode='42501'; end if;
 if p_feature is not null and p_feature not in ('advanced-analytics','performance-heatmap','strategy-comparison','risk-intelligence','periodic-review')
 then raise exception 'Unsupported Pro feature' using errcode='22023'; end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',t.id,'opened_at',t.opened_at,'pnl',t.pnl,'risk_percent',t.risk_percent,
 'realized_rr',t.realized_rr,'planned_rr',t.planned_rr,'strategy',s.name,'symbol',t.symbol,'side',t.side,'status',t.status,
 'emotion_before',t.emotion_before,'emotion_after',t.emotion_after,'account_id',t.account_id,'notes',t.notes) order by t.opened_at),'[]'::jsonb)
 into data from public.trades t left join public.strategies s on s.id=t.strategy_id and s.user_id=uid where t.user_id=uid and t.status='closed';
 return case when p_feature is null then data else jsonb_build_object('feature',p_feature,'trades',data) end;
end $$;
create or replace function public.journal_pro_analytics() returns jsonb language sql security invoker set search_path='' as $$ select journal_private.pro_analytics(); $$;
create or replace function public.journal_pro_analytics(feature_key text) returns jsonb language sql security invoker set search_path='' as $$ select journal_private.pro_analytics(feature_key); $$;

create function journal_private.create_job(p_kind text,p_payload jsonb,p_idempotency_key uuid,p_payload_hash text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); a jsonb; j public.platform_jobs; pid uuid; n integer;
begin
 if uid is null then raise exception 'Authentication required' using errcode='28000'; end if;
 if p_kind is null or p_kind not in ('behaviour','journal','market','report','review','import') or p_idempotency_key is null
 or p_payload_hash is null or p_payload_hash !~ '^[a-f0-9]{64}$' or p_payload is null or jsonb_typeof(p_payload)<>'object'
 or octet_length(p_payload::text)>262144 then raise exception 'Invalid job request' using errcode='22023'; end if;
 perform pg_advisory_xact_lock(hashtextextended(uid::text,0));
 a:=journal_private.user_access(uid);
 if p_kind<>'import' and a->>'plan'<>'pro' then raise exception 'Active Pro required' using errcode='42501'; end if;
 select * into j from public.platform_jobs where user_id=uid and idempotency_key=p_idempotency_key;
 if found then
  if j.kind<>p_kind or j.payload_hash<>p_payload_hash or j.payload<>p_payload then
   raise exception 'Idempotency key reused with different request' using errcode='22023'; end if;
  return to_jsonb(j);
 end if;
 if p_kind='review' then
  select * into j from public.platform_jobs where user_id=uid and kind='review'
   and status in ('queued','running') and payload=p_payload order by created_at limit 1;
  if found then return to_jsonb(j); end if;
 end if;
 if p_kind='report' then
  select count(*) into n from public.platform_jobs where user_id=uid and kind='report' and created_at>now()-interval '10 minutes';
  if n>=10 then raise exception 'Report rate limit' using errcode='P0001'; end if;
  select count(*) into n from public.platform_jobs where user_id=uid and kind='report' and status in ('queued','running');
  if n>=3 then raise exception 'Report concurrency limit' using errcode='P0001'; end if;
 end if;
 if p_kind='import' then
  if p_payload->>'storage_path' is null or p_payload->>'storage_path' !~ ('^'||uid::text||'/[a-f0-9]{64}\.(pdf|png|jpg|jpeg|csv|txt)$')
  or not exists(select 1 from storage.objects where bucket_id='journal-imports' and name=p_payload->>'storage_path')
  then raise exception 'Owned import file required' using errcode='42501'; end if;
  select count(*) into n from public.platform_jobs where user_id=uid and kind='import' and status in ('queued','running');
  if n>=3 then raise exception 'Import concurrency limit' using errcode='P0001'; end if;
  if a->>'plan'='free' and (select count(*) from public.platform_jobs where user_id=uid and kind='import' and status='succeeded' and finished_at>now()-interval '12 hours')>=10
  then raise exception 'Import allowance exhausted' using errcode='P0001'; end if;
 end if;
 if p_kind in ('behaviour','journal','market') then
  insert into journal_private.usage_periods(user_id,starts_at,ends_at)
  values(uid,(a->>'periodStart')::timestamptz,(a->>'periodEnd')::timestamptz) on conflict do nothing;
  update journal_private.usage_periods set reserved=reserved+1 where user_id=uid and starts_at=(a->>'periodStart')::timestamptz
  and used+reserved<30 returning id into pid;
  if pid is null then raise exception 'AI allowance exhausted' using errcode='P0001'; end if;
 end if;
 insert into public.platform_jobs(user_id,kind,idempotency_key,payload_hash,payload,quota_period_id)
 values(uid,p_kind,p_idempotency_key,p_payload_hash,p_payload,pid) returning * into j;
 return to_jsonb(j);
end $$;
create function public.journal_create_job(p_kind text,p_payload jsonb,p_idempotency_key uuid,p_payload_hash text) returns jsonb
language sql security invoker set search_path='' as $$ select journal_private.create_job(p_kind,p_payload,p_idempotency_key,p_payload_hash); $$;

create function journal_private.job(p_job_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare j public.platform_jobs;
begin
 if auth.uid() is null then raise exception 'Authentication required' using errcode='28000'; end if;
 select * into j from public.platform_jobs where id=p_job_id and user_id=auth.uid() and deleted_at is null;
 if not found then raise exception 'Job not found' using errcode='P0002'; end if;
 if j.kind<>'import' and not journal_private.is_pro() then raise exception 'Active Pro required' using errcode='42501'; end if;
 return to_jsonb(j);
end $$;
create function public.journal_job(p_job_id uuid) returns jsonb language sql security invoker set search_path='' as $$ select journal_private.job(p_job_id); $$;
create function journal_private.cancel_job(p_job_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare j public.platform_jobs;
begin
 if auth.uid() is null then raise exception 'Authentication required' using errcode='28000'; end if;
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,0));
 select * into j from public.platform_jobs where id=p_job_id and user_id=auth.uid() for update;
 if not found then raise exception 'Job not found' using errcode='P0002'; end if;
 if j.status in ('queued','running') then
  update public.platform_jobs set status='cancelled',finished_at=now(),worker_id=null,lease_until=null where id=j.id returning * into j;
  if j.quota_period_id is not null then update journal_private.usage_periods set reserved=reserved-1 where id=j.quota_period_id; end if;
 end if;
 return to_jsonb(j);
end $$;
create function public.journal_cancel_job(p_job_id uuid) returns jsonb language sql security invoker set search_path='' as $$ select journal_private.cancel_job(p_job_id); $$;
create function journal_private.delete_job(p_job_id uuid) returns boolean language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'Authentication required' using errcode='28000'; end if;
 -- Retain the request timestamp so deleting a report cannot reset fair-use accounting.
 update public.platform_jobs set deleted_at=now() where id=p_job_id and user_id=auth.uid() and kind='report' and status not in ('queued','running') and deleted_at is null;
 return found;
end $$;
create function public.journal_delete_job(p_job_id uuid) returns boolean language sql security invoker set search_path='' as $$ select journal_private.delete_job(p_job_id); $$;

-- Worker/provider RPCs are service-role only. No authenticated user can supply another user's ID here.
create function public.journal_user_access(p_user_id uuid) returns jsonb language sql security definer set search_path='' as $$ select journal_private.user_access(p_user_id); $$;
create function public.journal_claim_jobs(p_worker_id uuid,p_limit integer default 1) returns jsonb
language plpgsql security definer set search_path='' as $$
declare j public.platform_jobs; result jsonb:='[]'::jsonb;
begin
 if p_worker_id is null or p_limit not between 1 and 3 then raise exception 'Invalid worker request' using errcode='22023'; end if;
 for j in select * from public.platform_jobs where status='queued' order by created_at for update skip locked limit p_limit loop
  update public.platform_jobs set status='running',worker_id=p_worker_id,lease_until=now()+interval '10 minutes' where id=j.id returning * into j;
  result:=result||jsonb_build_array(to_jsonb(j));
 end loop;
 return result;
end $$;
create function public.journal_finish_job(p_job_id uuid,p_worker_id uuid,p_result jsonb default null,p_error text default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare j public.platform_jobs; a jsonb;
begin
 select * into j from public.platform_jobs where id=p_job_id;
 if not found then raise exception 'Job not found' using errcode='P0002'; end if;
 perform pg_advisory_xact_lock(hashtextextended(j.user_id::text,0));
 select * into j from public.platform_jobs where id=p_job_id for update;
 if j.status<>'running' or j.worker_id is distinct from p_worker_id or j.lease_until<=now() then
  raise exception 'Invalid or expired worker lease' using errcode='42501'; end if;
 a:=journal_private.user_access(j.user_id);
 if p_error is null and j.kind<>'import' and a->>'plan'<>'pro' then p_error:='Subscription expired'; end if;
 if p_error is null and j.kind='import' and a->>'plan'='free' and (select count(*) from public.platform_jobs where user_id=j.user_id and kind='import' and status='succeeded' and finished_at>now()-interval '12 hours')>=10 then
  p_error:='Import allowance exhausted'; end if;
 if p_error is null and (p_result is null or jsonb_typeof(p_result)<>'object' or octet_length(p_result::text)>2097152)
 then raise exception 'Invalid result' using errcode='22023'; end if;
 update public.platform_jobs set status=case when p_error is null then 'succeeded' else 'failed' end,
 result=case when p_error is null then p_result else null end,error=left(p_error,500),finished_at=now(),worker_id=null,lease_until=null
 where id=j.id returning * into j;
 if j.quota_period_id is not null then
  update journal_private.usage_periods set reserved=reserved-1,used=used+case when p_error is null then 1 else 0 end where id=j.quota_period_id;
 end if;
 return to_jsonb(j);
end $$;
create function public.journal_recover_jobs() returns integer language plpgsql security definer set search_path='' as $$
declare j public.platform_jobs; n integer:=0;
begin
 -- Lock by user before job, matching cancellation/completion and avoiding lock-order inversions.
 for j in select * from public.platform_jobs where (status='running' and lease_until<=now()) or (status='queued' and created_at<now()-interval '1 hour') loop
  perform pg_advisory_xact_lock(hashtextextended(j.user_id::text,0));
  update public.platform_jobs set status='expired',error='Job timed out',finished_at=now(),worker_id=null,lease_until=null
  where id=j.id and ((status='running' and lease_until<=now()) or (status='queued' and created_at<now()-interval '1 hour'));
  if found then
   if j.quota_period_id is not null then update journal_private.usage_periods set reserved=reserved-1 where id=j.quota_period_id; end if;
   n:=n+1;
  end if;
 end loop;
 return n;
end $$;

create function public.journal_confirm_import(p_job_id uuid,p_worker_id uuid,p_trades jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare j public.platform_jobs; t jsonb; tid uuid; aid uuid; sid uuid; result jsonb; ids jsonb:='[]'::jsonb; duplicates integer:=0; inserted integer:=0;
begin
 select * into j from public.platform_jobs where id=p_job_id;
 if not found then raise exception 'Job not found' using errcode='P0002'; end if;
 perform pg_advisory_xact_lock(hashtextextended(j.user_id::text,0));
 select * into j from public.platform_jobs where id=p_job_id for update;
 if j.kind<>'import' or j.status<>'running' or j.worker_id is distinct from p_worker_id or j.lease_until<=now()
 then raise exception 'Invalid import lease' using errcode='42501'; end if;
 if not exists(select 1 from storage.objects where bucket_id='journal-imports' and name=j.payload->>'storage_path'
 and (storage.foldername(name))[1]=j.user_id::text) then raise exception 'Import file unavailable' using errcode='42501'; end if;
 if p_trades is null or jsonb_typeof(p_trades)<>'array' or jsonb_array_length(p_trades) not between 1 and 500
 then raise exception 'Invalid import records' using errcode='22023'; end if;
 if journal_private.user_access(j.user_id)->>'plan'='free' and (select count(*) from public.platform_jobs where user_id=j.user_id and kind='import' and status='succeeded' and finished_at>now()-interval '12 hours')>=10
 then raise exception 'Import allowance exhausted' using errcode='P0001'; end if;
 for t in select value from jsonb_array_elements(p_trades) loop
  tid:=coalesce((t->>'id')::uuid,gen_random_uuid()); aid:=(t->>'account_id')::uuid; sid:=(t->>'strategy_id')::uuid;
  if jsonb_typeof(t)<>'object' or aid is null or not exists(select 1 from public.trading_accounts where id=aid and user_id=j.user_id)
  or (sid is not null and not exists(select 1 from public.strategies where id=sid and user_id=j.user_id))
  or exists(select 1 from public.trades where id=tid and user_id<>j.user_id)
  then raise exception 'Import ownership mismatch' using errcode='42501'; end if;
  if t->>'side' is null or t->>'side' not in ('long','short') or coalesce(t->>'status','closed')<>'closed'
  or t->>'symbol' is null or length(t->>'symbol') not between 1 and 80
  or t->>'opened_at' is null or t->>'closed_at' is null or t->>'opened_at' !~ '(Z|[+-][0-9]{2}:[0-9]{2})$' or t->>'closed_at' !~ '(Z|[+-][0-9]{2}:[0-9]{2})$'
  or (t->>'quantity')::numeric<=0 or (t->>'quantity')::numeric>=1e20
  or (t->>'entry_price')::numeric<=0 or (t->>'exit_price')::numeric<=0 or coalesce((t->>'fees')::numeric,0)<0
  or (t->>'opened_at')::timestamptz>(t->>'closed_at')::timestamptz
  then raise exception 'Invalid trade values' using errcode='22023'; end if;
  if exists(select 1 from public.trades where id=tid and user_id=j.user_id) or exists(select 1 from public.trades x
   where x.user_id=j.user_id and x.account_id=aid and x.symbol=t->>'symbol' and x.side=t->>'side'
   and x.opened_at=(t->>'opened_at')::timestamptz and x.closed_at is not distinct from (t->>'closed_at')::timestamptz
   and x.entry_price is not distinct from (t->>'entry_price')::numeric and x.exit_price is not distinct from (t->>'exit_price')::numeric
   and x.quantity is not distinct from (t->>'quantity')::numeric and x.pnl is not distinct from (t->>'pnl')::numeric)
  then duplicates:=duplicates+1; continue; end if;
  insert into public.trades(id,user_id,account_id,strategy_id,symbol,market,side,status,opened_at,closed_at,entry_price,exit_price,stop_loss,take_profit,quantity,pnl,fees,risk_percent,notes,tags)
  values(tid,j.user_id,aid,sid,t->>'symbol',t->>'market',t->>'side','closed',(t->>'opened_at')::timestamptz,(t->>'closed_at')::timestamptz,
   (t->>'entry_price')::numeric,(t->>'exit_price')::numeric,(t->>'stop_loss')::numeric,(t->>'take_profit')::numeric,(t->>'quantity')::numeric,
   (t->>'pnl')::numeric,coalesce((t->>'fees')::numeric,0),(t->>'risk_percent')::numeric,t->>'notes',
   case when t->'tags' is null then '{}'::text[] else array(select jsonb_array_elements_text(t->'tags')) end);
  inserted:=inserted+1; ids:=ids||jsonb_build_array(tid);
 end loop;
 if inserted=0 then return public.journal_finish_job(j.id,p_worker_id,null,'No new trades after duplicate detection'); end if;
 result:=public.journal_finish_job(j.id,p_worker_id,jsonb_build_object('imported',inserted,'duplicates',duplicates,'tradeIds',ids),null);
 if result->>'status'<>'succeeded' then raise exception 'Import completion failed' using errcode='P0001'; end if;
 return result;
end $$;

create function public.journal_record_subscription(p_provider text,p_event_id text,p_payload_hash text,p_user_id uuid,
 p_subscription_id text,p_plan text,p_status text,p_interval text,p_period_start timestamptz,p_period_end timestamptz,
 p_event_at timestamptz,p_countries text[] default '{}') returns jsonb
language plpgsql security definer set search_path='' as $$
declare e journal_private.payment_events; s journal_private.subscriptions;
begin
 if p_provider is null or length(p_provider) not between 1 and 64 or p_event_id is null or length(p_event_id) not between 1 and 256
 or p_subscription_id is null or length(p_subscription_id) not between 1 and 256 or p_payload_hash is null or p_payload_hash !~ '^[a-f0-9]{64}$'
 or p_event_at is null or p_event_at>now()+interval '5 minutes' or p_user_id is null or p_countries is null
 or exists(select 1 from unnest(p_countries) c where c is null or c !~ '^[A-Z]{2}$') then raise exception 'Invalid subscription event' using errcode='22023'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_user_id::text,0));
 select * into e from journal_private.payment_events where provider=p_provider and event_id=p_event_id;
 if found then
  if e.payload_hash<>p_payload_hash or e.user_id<>p_user_id then raise exception 'Webhook key conflict' using errcode='22023'; end if;
  return journal_private.user_access(p_user_id);
 end if;
 insert into journal_private.payment_events(provider,event_id,payload_hash,user_id,occurred_at) values(p_provider,p_event_id,p_payload_hash,p_user_id,p_event_at);
 insert into journal_private.subscriptions(user_id,provider,provider_subscription_id,plan,status,billing_interval,period_start,period_end,countries,event_at)
 values(p_user_id,p_provider,p_subscription_id,p_plan,p_status,p_interval,p_period_start,p_period_end,p_countries,p_event_at)
 on conflict(user_id) do update set provider=excluded.provider,provider_subscription_id=excluded.provider_subscription_id,
 plan=excluded.plan,status=excluded.status,billing_interval=excluded.billing_interval,period_start=excluded.period_start,
 period_end=excluded.period_end,countries=excluded.countries,event_at=excluded.event_at,updated_at=now()
 where excluded.event_at>journal_private.subscriptions.event_at;
 return journal_private.user_access(p_user_id);
end $$;

create function journal_private.rate_limit(p_bucket text,p_limit integer,p_window_seconds integer) returns boolean
language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); n integer;
begin
 if uid is null then raise exception 'Authentication required' using errcode='28000'; end if;
 if p_bucket is null or p_limit is null or p_window_seconds is null
 or not ((p_bucket='pro_api' and p_limit=120 and p_window_seconds=60) or (p_bucket='pro_upload' and p_limit=10 and p_window_seconds=600))
 then raise exception 'Invalid rate limit' using errcode='22023'; end if;
 insert into journal_private.rate_buckets(user_id,bucket,starts_at,requests) values(uid,p_bucket,now(),1)
 on conflict(user_id,bucket) do update set
 requests=case when journal_private.rate_buckets.starts_at+make_interval(secs=>p_window_seconds)<=now() then 1 else journal_private.rate_buckets.requests+1 end,
 starts_at=case when journal_private.rate_buckets.starts_at+make_interval(secs=>p_window_seconds)<=now() then now() else journal_private.rate_buckets.starts_at end
 returning requests into n;
 return n<=p_limit;
end $$;
create function public.journal_rate_limit(p_bucket text,p_limit integer,p_window_seconds integer) returns boolean
language sql security invoker set search_path='' as $$ select journal_private.rate_limit(p_bucket,p_limit,p_window_seconds); $$;

do $$ declare t text; begin
 foreach t in array array['subscriptions','payment_events','usage_periods','rate_buckets'] loop
  execute format('alter table journal_private.%I enable row level security',t);
  execute format('revoke all on journal_private.%I from public,anon,authenticated',t);
 end loop;
 foreach t in array array['platform_jobs','risk_rules','performance_reviews','trade_executions'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on public.%I from public,anon,authenticated',t);
  execute format('grant select on public.%I to authenticated',t);
  execute format('grant all on public.%I to service_role',t);
 end loop;
end $$;
create policy platform_jobs_read on public.platform_jobs for select to authenticated
 using(user_id=(select auth.uid()) and deleted_at is null and (kind='import' or (select journal_private.is_pro())));
create policy risk_rules_owner on public.risk_rules for all to authenticated
 using(user_id=(select auth.uid()) and (select journal_private.is_pro()))
 with check(user_id=(select auth.uid()) and (select journal_private.is_pro()));
create policy reviews_owner on public.performance_reviews for all to authenticated
 using(user_id=(select auth.uid()) and (select journal_private.is_pro()))
 with check(user_id=(select auth.uid()) and (select journal_private.is_pro())
 and (account_id is null or exists(select 1 from public.trading_accounts a where a.id=account_id and a.user_id=(select auth.uid()))));
create policy executions_owner on public.trade_executions for all to authenticated
 using(user_id=(select auth.uid()))
 with check(user_id=(select auth.uid()) and exists(select 1 from public.trades t where t.id=trade_id and t.user_id=(select auth.uid())));
grant insert,update,delete on public.risk_rules,public.performance_reviews,public.trade_executions to authenticated;

revoke all on function journal_private.user_access(uuid),journal_private.own_access(),journal_private.is_pro(),journal_private.pro_analytics(text),
 journal_private.create_job(text,jsonb,uuid,text),journal_private.job(uuid),journal_private.cancel_job(uuid),
 journal_private.delete_job(uuid),journal_private.rate_limit(text,integer,integer) from public,anon,authenticated;
grant usage on schema journal_private to authenticated,service_role;
grant execute on function journal_private.own_access(),journal_private.is_pro(),journal_private.pro_analytics(text),journal_private.create_job(text,jsonb,uuid,text),
 journal_private.job(uuid),journal_private.cancel_job(uuid),journal_private.delete_job(uuid),journal_private.rate_limit(text,integer,integer) to authenticated;
revoke all on function public.journal_pro_analytics(),public.journal_pro_analytics(text),public.journal_platform_access(),public.journal_entitlements(),public.journal_create_job(text,jsonb,uuid,text),
 public.journal_job(uuid),public.journal_cancel_job(uuid),public.journal_delete_job(uuid),public.journal_rate_limit(text,integer,integer) from public,anon;
grant execute on function public.journal_pro_analytics(),public.journal_pro_analytics(text),public.journal_platform_access(),public.journal_entitlements(),public.journal_create_job(text,jsonb,uuid,text),
 public.journal_job(uuid),public.journal_cancel_job(uuid),public.journal_delete_job(uuid),public.journal_rate_limit(text,integer,integer) to authenticated;
revoke all on function public.journal_user_access(uuid),public.journal_claim_jobs(uuid,integer),public.journal_finish_job(uuid,uuid,jsonb,text),
 public.journal_confirm_import(uuid,uuid,jsonb),public.journal_recover_jobs(),public.journal_record_subscription(text,text,text,uuid,text,text,text,text,timestamptz,timestamptz,timestamptz,text[]) from public,anon,authenticated;
grant execute on function public.journal_user_access(uuid),public.journal_claim_jobs(uuid,integer),public.journal_finish_job(uuid,uuid,jsonb,text),
 public.journal_confirm_import(uuid,uuid,jsonb),public.journal_recover_jobs(),public.journal_record_subscription(text,text,text,uuid,text,text,text,text,timestamptz,timestamptz,timestamptz,text[]) to service_role;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values
 ('journal-reports','journal-reports',false,20971520,array['application/pdf']),
 ('journal-imports','journal-imports',false,20971520,array['application/pdf','image/png','image/jpeg','text/csv','text/plain','application/octet-stream']);
create policy journal_report_owner_read on storage.objects for select to authenticated
 using(bucket_id='journal-reports' and (storage.foldername(name))[1]=(select auth.uid())::text and (select journal_private.is_pro()));
create policy journal_report_owner_delete on storage.objects for delete to authenticated
 using(bucket_id='journal-reports' and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy journal_import_owner_read on storage.objects for select to authenticated
 using(bucket_id='journal-imports' and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy journal_import_owner_insert on storage.objects for insert to authenticated
 with check(bucket_id='journal-imports' and (storage.foldername(name))[1]=(select auth.uid())::text
 and name ~ '^[a-f0-9-]{36}/[a-f0-9]{64}\.(pdf|png|jpg|jpeg|csv|txt)$');
create policy journal_import_owner_delete on storage.objects for delete to authenticated
 using(bucket_id='journal-imports' and (storage.foldername(name))[1]=(select auth.uid())::text);
