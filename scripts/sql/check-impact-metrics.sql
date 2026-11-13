\set ON_ERROR_STOP on
begin;
create function pg_temp.assert(ok boolean,msg text) returns void language plpgsql as $$ begin if ok is distinct from true then raise exception 'ASSERT: %',msg; end if; end $$;
create function pg_temp.denied(q text) returns boolean language plpgsql as $$ begin execute q; return false; exception when insufficient_privilege or check_violation then return true; end $$;
select id as admin from public.profiles where role='admin' and active limit 1 \gset
select id as employee from public.profiles where role='employee' and active limit 1 \gset
select id as handler from public.profiles where role='handler' and active limit 1 \gset
select id as request from public.requests where assignee_id is distinct from :'handler'::uuid limit 1 \gset
set local role authenticated;
select set_config('request.jwt.claim.sub', :'admin',true);
insert into public.request_impact_metrics(request_id,hours_per_month,monthly_value,currency,basis) values (:'request',12.5,50000,'KZT','10 people × 5 minutes × 15 operations per month') on conflict(request_id) do update set hours_per_month=12.5,monthly_value=50000,currency='KZT',basis=excluded.basis;
select pg_temp.assert((select hours_per_month=12.5 from public.request_impact_metrics where request_id=:'request'),'admin saved metrics');
update public.request_impact_metrics set hours_per_month=0 where request_id=:'request';
select pg_temp.assert((select hours_per_month=0 from public.request_impact_metrics where request_id=:'request'),'zero preserved');
select pg_temp.assert(pg_temp.denied(format('update public.request_impact_metrics set hours_per_month=-1 where request_id=%L',:'request')),'negative rejected');
select pg_temp.assert(pg_temp.denied(format('update public.request_impact_metrics set currency=null where request_id=%L',:'request')),'value requires currency');
select pg_temp.assert(pg_temp.denied(format('update public.request_impact_metrics set basis=%L where request_id=%L','',:'request')),'estimate requires basis');
select set_config('request.jwt.claim.sub', :'employee',true);
select pg_temp.assert((select count(*)=0 from public.request_impact_metrics),'employee metrics hidden');
select pg_temp.assert(pg_temp.denied(format('insert into public.request_impact_metrics(request_id) values (%L)',:'request')),'employee write denied');
select set_config('request.jwt.claim.sub', :'handler',true);
select pg_temp.assert((select count(*)=0 from public.request_impact_metrics where request_id=:'request'),'unassigned handler metrics hidden');
reset role;
update public.profiles set active=false where id=:'admin';
set local role authenticated;
select set_config('request.jwt.claim.sub', :'admin',true);
select pg_temp.assert((select count(*)=0 from public.request_impact_metrics),'inactive staff denied');
select 'PASS metrics persistence, zero, validation, employee/handler scope and inactive staff';
rollback;
