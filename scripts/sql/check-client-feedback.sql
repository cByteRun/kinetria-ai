\set ON_ERROR_STOP on
begin;
create function pg_temp.assert(ok boolean,msg text) returns void language plpgsql as $$ begin if ok is distinct from true then raise exception 'ASSERT: %',msg; end if; end $$;
create function pg_temp.denied(q text) returns boolean language plpgsql as $$ begin execute q; return false; exception when insufficient_privilege or sqlstate 'PT404' or sqlstate 'PT409' or invalid_parameter_value then return true; end $$;
select id as client from public.profiles where role='client' limit 1 \gset
select id as employee from public.profiles where role='employee' limit 1 \gset
select id as admin from public.profiles where role='admin' limit 1 \gset
select id as manager from public.profiles where role='manager' limit 1 \gset
insert into auth.users(id) values('98000000-0000-4000-8000-000000000001');
insert into public.profiles(id,role,display_name) values('98000000-0000-4000-8000-000000000001','client','Other client');
set local role authenticated;
select set_config('request.jwt.claim.sub', :'client',true);
select pg_temp.assert((select count(*)=0 from public.requests),'client cannot read internal requests');
select pg_temp.assert((select count(*)=0 from public.request_events),'client cannot read history');
select pg_temp.assert((select count(*)=0 from public.request_attachments),'client cannot read files');
select pg_temp.assert((select count(*)=0 from public.request_enrichments),'client cannot read financial metrics');
select pg_temp.assert(pg_temp.denied('select * from public.feedback'),'no direct raw feedback access');
select pg_temp.assert(pg_temp.denied($q$select public.submit_with_files(gen_random_uuid(),'catalog','idea','bad','bad','',5::smallint,'{}','[]')$q$),'client cannot use internal submit');
select public.feedback_portal('submit','{"key":"98000000-0000-4000-8000-000000000002","category":"catalog","kind":"problem","title":"PRIVATE CLIENT ID 123","description":"Private contract and personal information","hint":"2 hours per week"}') as submitted \gset
select (:'submitted'::jsonb->>'id') as feedback, (:'submitted'::jsonb->>'request_id') as request \gset
select pg_temp.assert(public.feedback_portal('submit','{"key":"98000000-0000-4000-8000-000000000002","category":"catalog","kind":"problem","title":"PRIVATE CLIENT ID 123","description":"Private contract and personal information","hint":"2 hours per week"}')=:'submitted'::jsonb,'submission idempotence');
select pg_temp.assert(pg_temp.denied($q$select public.feedback_portal('submit','{"key":"98000000-0000-4000-8000-000000000002","category":"it","title":"changed","description":"changed"}')$q$),'changed replay rejected');
select pg_temp.assert(public.feedback_portal('list') @> jsonb_build_array(jsonb_build_object('id',:'feedback','own',true,'request_id',null)),'own private feedback visible without internal ID');
select pg_temp.assert(pg_temp.denied(format('select public.feedback_portal(%L,%L)','moderate',jsonb_build_object('id',:'feedback','version',1,'published',true,'public_title','exfiltrate','public_description','exfiltrate'))),'client cannot moderate');
select set_config('request.jwt.claim.sub','98000000-0000-4000-8000-000000000001',true);
select pg_temp.assert(not public.feedback_portal('list') @> jsonb_build_array(jsonb_build_object('id',:'feedback')),'other client cannot see private feedback');
select pg_temp.assert(pg_temp.denied(format('select public.feedback_portal(%L,%L)','vote',jsonb_build_object('id',:'feedback'))),'cannot vote on private feedback');
select set_config('request.jwt.claim.sub',:'admin',true);
select public.feedback_portal('moderate',jsonb_build_object('id',:'feedback','version',1,'published',true,'public_title','Improve response time','public_description','Please improve processing','response','We are reviewing this suggestion.'));
select pg_temp.assert(pg_temp.denied(format('select public.feedback_portal(%L,%L)','moderate',jsonb_build_object('id',:'feedback','version',1,'published',true,'public_title','stale','public_description','stale'))),'stale moderation rejected');
select set_config('request.jwt.claim.sub','98000000-0000-4000-8000-000000000001',true);
select pg_temp.assert(public.feedback_portal('list') @> jsonb_build_array(jsonb_build_object('id',:'feedback','title','Improve response time','description','Please improve processing','request_id',null)),'sanitized public projection');
select pg_temp.assert(position('PRIVATE CLIENT' in public.feedback_portal('list')::text)=0,'private text never serialized to others');
select public.feedback_portal('vote',jsonb_build_object('id',:'feedback','support',true));
select public.feedback_portal('vote',jsonb_build_object('id',:'feedback','support',true));
select pg_temp.assert(public.feedback_portal('list') @> jsonb_build_array(jsonb_build_object('id',:'feedback','votes',1,'supported',true)),'one vote per user, idempotent retry');
reset role;
update public.requests set status='implemented',decision='PRIVATE INTERNAL DECISION',version=version+1 where id=:'request';
select pg_temp.assert((select status='implemented' and response='We are reviewing this suggestion.' from public.feedback where id=:'feedback'),'status sync without publishing internal decision');
-- Telegram client uses only the portal bridge; forged internal operations stay forbidden.
insert into public.telegram_links(telegram_id,user_id) values(989000001,:'client') on conflict(telegram_id) do update set user_id=excluded.user_id;
select pg_temp.assert(public.telegram_bridge(989000001,'context')->>'role'='client','client Telegram context');
select pg_temp.assert(jsonb_typeof(public.telegram_bridge(989000001,'portal','{"op":"list"}'))='array','client Telegram portal');
select pg_temp.assert(pg_temp.denied(format('select public.telegram_bridge(989000001,%L,%L)','detail',jsonb_build_object('id',:'request'))),'client cannot forge detail callback');
select pg_temp.assert(pg_temp.denied($q$select public.telegram_bridge(989000001,'qvin')$q$),'client cannot access Qvin');
select pg_temp.assert(exists(select 1 from public.telegram_outbox where request_id=:'request' and event='status'),'durable status notification');
select 'PASS: client isolation, private/public projection, idempotency, votes, concurrency, internal status sync, Telegram restrictions, outbox';
rollback;
