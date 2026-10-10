-- Founder Pro entitlement tests use verified identities and rollback all writes.
begin;
insert into auth.users(id,email,email_confirmed_at) values
 ('f0b10000-0000-4000-a000-000000000001','kaylafisika24@gmail.com',now()),
 ('f0b10000-0000-4000-a000-000000000002','gamingyoga14@gmail.com',now()),
 ('f0b10000-0000-4000-a000-000000000003','kaylafisika24@gmail.com',null),
 ('f0b10000-0000-4000-a000-000000000004','ordinary@example.invalid',now());
set local role authenticated;
select set_config('request.jwt.claim.sub','f0b10000-0000-4000-a000-000000000001',true);
do $$ declare a jsonb; begin
 a:=public.journal_founder_entitlements();
 assert a->>'plan'='pro' and (a->>'founder')::boolean,'Kayla founder lacks Pro';
 assert (a->>'aiLimit')::integer=30,'Founder AI allowance missing';
 assert (public.journal_access())->>'plan'='pro','Founder legacy access missing';
 assert a->>'effectiveUntil' is not null,'Pro UI entitlement expiry missing';
end $$;
select set_config('request.jwt.claim.sub','f0b10000-0000-4000-a000-000000000002',true);
do $$ begin assert public.journal_founder_entitlements()->>'plan'='pro','Second founder lacks Pro'; end $$;
select set_config('request.jwt.claim.sub','f0b10000-0000-4000-a000-000000000003',true);
do $$ begin assert public.journal_founder_entitlements()->>'plan'='free','Unverified founder email received Pro'; end $$;
select set_config('request.jwt.claim.sub','f0b10000-0000-4000-a000-000000000004',true);
do $$ begin assert public.journal_founder_entitlements()->>'plan'='free','Ordinary user received Founder Pro'; end $$;
rollback;
