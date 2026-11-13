// One-off deployment repair: apply the missing predecessor without replacing the topics bridge.
// Run in the verified Vercel project environment. Never prints credentials or row content.
import {readFile} from 'node:fs/promises'
import {pathToFileURL} from 'node:url'
const version='20261113014456',name='client_feedback_impact_qvin'
const ref=new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname.split('.')[0]
const {default:pg}=await import(pathToFileURL(process.env.MIGRATION_PG_MODULE||'/tmp/idearoute-migration/node_modules/pg/lib/index.js').href)
const certificate=await fetch('https://supabase-downloads.s3-ap-southeast-1.amazonaws.com/prod/ssl/prod-ca-2021.crt',{signal:AbortSignal.timeout(15000)})
if(!certificate.ok)throw Error('Supabase CA unavailable')
const ca=await certificate.text();if(!ca.includes('-----BEGIN CERTIFICATE-----'))throw Error('Invalid CA')
let client
try{
 for(const raw of [...new Set([process.env.POSTGRES_URL_NON_POOLING,process.env.POSTGRES_URL].filter(Boolean))]){
  const url=new URL(raw)
  if(url.hostname!==`db.${ref}.supabase.co`&&decodeURIComponent(url.username)!==`postgres.${ref}`)throw Error('Database target mismatch')
  for(const key of ['sslmode','sslcert','sslkey','sslrootcert'])url.searchParams.delete(key)
  const candidate=new pg.Client({connectionString:url.href,ssl:{ca,rejectUnauthorized:true},connectionTimeoutMillis:15000})
  try{await candidate.connect();client=candidate;break}catch(e){await candidate.end().catch(()=>{});console.log('Connection attempt failed:',e.code||'connection error')}
 }
 if(!client)throw Error('No matching database connection available')
 await client.query('begin');await client.query("set local lock_timeout='15s'");await client.query("set local statement_timeout='45s'");await client.query('select pg_advisory_xact_lock(872031104)')
 const state=(await client.query(`select
  to_regclass('public.feedback') is not null as feedback,
  to_regclass('public.request_enrichments') is not null as impacts,
  to_regprocedure('public.submit_with_impact(uuid,text,public.request_kind,text,text,text,smallint,text[],jsonb,text)') is not null as submit,
  to_regprocedure('kinetria_private.telegram_bridge_before_topics(bigint,text,jsonb)') is not null as topics_wrapper,
  exists(select 1 from information_schema.columns where table_schema='public' and table_name='requests' and column_name='origin') as origin`)).rows[0]
 const applied=(await client.query('select version from supabase_migrations.schema_migrations where version=$1',[version])).rowCount
 const bridgeBefore=(await client.query("select pg_get_functiondef('kinetria_private.telegram_bridge(bigint,text,jsonb)'::regprocedure) as body")).rows[0].body
 if(!applied){
  if(state.feedback||state.impacts||state.submit||state.origin)throw Error('Partial migration requires inspection')
  let sql=await readFile(`supabase/migrations/${version}_${name}.sql`,'utf8')
  if(state.topics_wrapper){
   if(!bridgeBefore.includes('topic_service'))throw Error('Unexpected topics bridge')
   sql=sql.replace('create or replace function kinetria_private.telegram_bridge(', 'create or replace function kinetria_private.telegram_bridge_before_topics(')
  }
  await client.query(sql)
  await client.query('insert into supabase_migrations.schema_migrations(version,name,statements) values($1,$2,$3)',[version,name,[sql]])
  console.log('Applied migration:',version+'_'+name)
 }
 const check=(await client.query(`select
  to_regprocedure('public.submit_with_impact(uuid,text,public.request_kind,text,text,text,smallint,text[],jsonb,text)') is not null as submit,
  to_regprocedure('public.feedback_portal(text,jsonb)') is not null as portal,
  (select count(*)::int from pg_class where oid in('public.feedback'::regclass,'public.feedback_votes'::regclass,'public.request_enrichments'::regclass) and relrowsecurity) as rls_tables,
  has_function_privilege('anon','public.submit_with_impact(uuid,text,public.request_kind,text,text,text,smallint,text[],jsonb,text)','execute') as anon_submit,
  has_function_privilege('authenticated','public.submit_with_impact(uuid,text,public.request_kind,text,text,text,smallint,text[],jsonb,text)','execute') as user_submit,
  has_table_privilege('authenticated','public.feedback','select') as raw_feedback`)).rows[0]
 if(!check.submit||!check.portal||check.rls_tables!==3||check.anon_submit||!check.user_submit||check.raw_feedback)throw Error('Migration permissions verification failed')
 if(state.topics_wrapper){const bridgeAfter=(await client.query("select pg_get_functiondef('kinetria_private.telegram_bridge(bigint,text,jsonb)'::regprocedure) as body")).rows[0].body;if(bridgeAfter!==bridgeBefore)throw Error('Topics bridge was changed')}
 // Prove a registration can commit its core objects; rollback only this synthetic test.
 await client.query('savepoint registration_probe')
 const actor=(await client.query("select p.id,c.id as category from public.profiles p cross join public.request_categories c where p.active and p.role='employee' and c.active order by p.id,c.id limit 1")).rows[0]
 if(!actor)throw Error('No synthetic employee/category available')
 await client.query("select set_config('request.jwt.claim.sub',$1,true),set_config('request.jwt.claims',$2,true)",[actor.id,JSON.stringify({sub:actor.id,role:'authenticated'})])
 const probe=(await client.query("select public.submit_with_impact(gen_random_uuid(),$1,'problem','Synthetic migration probe','Rollback-only registration probe','',5::smallint,array[]::text[],'[]'::jsonb,'') as id",[actor.category])).rows[0]
 if(!probe.id)throw Error('Registration probe failed')
 await client.query('rollback to savepoint registration_probe')
 await client.query("notify pgrst, 'reload schema'");await client.query('commit')
 console.log('PASS product expansion: registration probe ROLLBACK, RLS/grants verified, topics bridge preserved, schema cache reloaded')
}catch(e){if(client)await client.query('rollback').catch(()=>{});console.error('Product migration failed:',e.code||e.message?.replace(/(?:postgres(?:ql)?:\/\/)[^\s]+/g,'<DB_URL>')||'configuration/connection error');process.exitCode=1}
finally{if(client)await client.end()}
