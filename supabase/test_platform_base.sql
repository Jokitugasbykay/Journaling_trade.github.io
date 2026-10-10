-- Isolated test bootstrap only. Never apply this file to any hosted project.
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
create schema auth;
create table auth.users(id uuid primary key,email text);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
grant usage on schema auth to authenticated,anon,service_role;
grant execute on function auth.uid() to authenticated,anon,service_role;
-- Core column types/defaults/constraints are reconstructed from read-only live catalog inspection.
-- nickname_set is subsequently added by the checked-in access.sql, matching the legacy migration order.
create table public.profiles(id uuid primary key references auth.users(id) on delete cascade,display_name text,avatar_url text,base_currency text not null default 'USD',timezone text not null default 'Asia/Jakarta',created_at timestamptz not null default now(),updated_at timestamptz not null default now());
create table public.trading_accounts(id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id) on delete cascade,name text not null,broker text,account_type text,initial_balance numeric(20,4) not null default 0,currency text not null default 'USD',is_active boolean not null default true,created_at timestamptz not null default now(),updated_at timestamptz not null default now());
create table public.strategies(id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id) on delete cascade,name text not null,description text,rules text,created_at timestamptz not null default now(),unique(user_id,name));
create table public.trades(id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id) on delete cascade,account_id uuid references public.trading_accounts(id) on delete set null,strategy_id uuid references public.strategies(id) on delete set null,symbol text not null,market text,side text not null check(side in ('long','short')),status text not null default 'closed' check(status in ('planned','open','closed','cancelled')),opened_at timestamptz,closed_at timestamptz,entry_price numeric(30,10),exit_price numeric(30,10),stop_loss numeric(30,10),take_profit numeric(30,10),quantity numeric(30,10),fees numeric(20,4) not null default 0,pnl numeric(20,4),pnl_percent numeric(12,4),risk_amount numeric(20,4),risk_percent numeric(12,4),planned_rr numeric(12,4),realized_rr numeric(12,4),setup_grade text,emotion_before text,emotion_after text,notes text,tags text[] not null default '{}',screenshot_url text,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),check(closed_at is null or opened_at is null or closed_at>=opened_at));
alter table public.trading_accounts enable row level security;
alter table public.strategies enable row level security;
alter table public.trades enable row level security;
create policy accounts_owner on public.trading_accounts for all to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
create policy strategies_owner on public.strategies for all to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
create policy trades_owner on public.trades for all to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid() and (account_id is null or exists(select 1 from public.trading_accounts a where a.id=account_id and a.user_id=auth.uid())) and (strategy_id is null or exists(select 1 from public.strategies s where s.id=strategy_id and s.user_id=auth.uid())));
grant all on public.trading_accounts,public.strategies,public.trades to authenticated,service_role;
grant select on public.trading_accounts,public.strategies,public.trades to anon;
-- Storage catalog fixture; this tests PostgreSQL policies, not the hosted Storage HTTP service.
create schema storage;
create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text references storage.buckets(id),name text not null);
create function storage.foldername(name text) returns text[] language sql immutable as $$ select string_to_array(name,'/') $$;
alter table storage.objects enable row level security;
grant usage on schema storage to authenticated,service_role;
grant all on storage.objects to authenticated,service_role;
grant execute on function storage.foldername(text) to authenticated,service_role;
