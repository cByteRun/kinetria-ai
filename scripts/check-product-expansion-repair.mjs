// Real local SQL regression: predecessor missing while topics already exists; all changes rollback.
import {readFile} from 'node:fs/promises'
import {spawnSync} from 'node:child_process'
const migration=(await readFile('supabase/migrations/20261113014456_client_feedback_impact_qvin.sql','utf8')).replace('create or replace function kinetria_private.telegram_bridge(', 'create or replace function kinetria_private.telegram_bridge_before_topics(')
const sql=`begin;
set client_min_messages=error;
create temporary table bridge_before as select pg_get_functiondef('kinetria_private.telegram_bridge(bigint,text,jsonb)'::regprocedure) as body;
drop function public.feedback_portal(text,jsonb);
drop function kinetria_private.feedback_portal(text,jsonb);
drop function public.submit_with_impact(uuid,text,public.request_kind,text,text,text,smallint,text[],jsonb,text);
drop function kinetria_private.submit_with_impact(uuid,text,public.request_kind,text,text,text,smallint,text[],jsonb,text);
drop function kinetria_private.feedback_status() cascade;
drop table public.feedback_votes,public.feedback,public.request_enrichments cascade;
alter table public.requests drop column origin,drop column impact_hint;
drop policy "Portal categories" on public.request_categories;
${migration}
do $$ declare actor uuid; category text; registered uuid; begin
 if (select body from bridge_before)<>pg_get_functiondef('kinetria_private.telegram_bridge(bigint,text,jsonb)'::regprocedure) then raise exception 'Topics wrapper changed'; end if;
 if has_function_privilege('anon','public.submit_with_impact(uuid,text,public.request_kind,text,text,text,smallint,text[],jsonb,text)','execute') then raise exception 'Anonymous submit allowed'; end if;
 if has_table_privilege('authenticated','public.feedback','select') then raise exception 'Raw feedback exposed'; end if;
 if (select count(*) from pg_class where oid in('public.feedback'::regclass,'public.feedback_votes'::regclass,'public.request_enrichments'::regclass) and relrowsecurity)<>3 then raise exception 'RLS missing'; end if;
 select p.id,c.id into actor,category from public.profiles p cross join public.request_categories c where p.active and p.role='employee' and c.active order by p.id,c.id limit 1;
 perform set_config('request.jwt.claim.sub',actor::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',actor,'role','authenticated')::text,true);
 registered:=public.submit_with_impact(gen_random_uuid(),category,'problem','Synthetic migration repair','Rollback-only registration probe','',5::smallint,array[]::text[],'[]'::jsonb,'');
 if registered is null or not exists(select 1 from public.requests where id=registered) then raise exception 'Registration failed'; end if;
end $$;
rollback;
`
const r=spawnSync('docker',['exec','-i',process.env.TELEGRAM_TEST_DB||'supabase_db_modus_IDEA','psql','-XqAt','-v','ON_ERROR_STOP=1','-U','postgres','-d','postgres'],{input:sql,encoding:'utf8'})
if(r.status!==0){console.error(r.stderr||'Local SQL check failed');process.exit(1)}
console.log('PASS out-of-order product migration: registration, RLS/grants and existing topics bridge; ROLLBACK')
