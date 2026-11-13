// Local-only integration test; never uses .env.local or a hosted database.
const assert=require('node:assert/strict')
const fs=require('node:fs')
const {Client}=require(process.env.TOPIC_PG_MODULE||'pg')
const client=new Client({host:'127.0.0.1',port:54322,user:process.env.PGUSER,password:process.env.PGPASSWORD,database:'postgres'})
async function main(){
 await client.connect()
 const migration='supabase/migrations/20261113021538_registry_topics.sql'
 if(!(await client.query("select to_regclass('public.topics') as t")).rows[0].t){await client.query('begin');try{await client.query(fs.readFileSync(migration,'utf8'));await client.query('commit')}catch(e){await client.query('rollback');throw e}}
 // Recreate the feature inside a rollback to validate the final migration
 // from its original predecessor, even when this local DB already has topics.
 await client.query('begin')
 try {
  await client.query(`drop function public.topic_service(text,jsonb);
   drop function kinetria_private.topic_service(text,jsonb);
   drop table public.topic_requests,public.topics;
   drop function kinetria_private.topic_visible(uuid),kinetria_private.topic_request_visible(uuid);
   drop function kinetria_private.telegram_bridge(bigint,text,jsonb);
   alter function kinetria_private.telegram_bridge_before_topics(bigint,text,jsonb) rename to telegram_bridge;`)
  await client.query(fs.readFileSync(migration,'utf8'))
  assert((await client.query("select to_regclass('public.topics_creator') as t")).rows[0].t)
  assert.equal((await client.query("select count(*)::int as n from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname in ('topics','topic_requests') and c.relrowsecurity")).rows[0].n,2)
  assert.equal((await client.query("select has_function_privilege('anon','public.topic_service(text,jsonb)','execute') as allowed")).rows[0].allowed,false)
  assert.equal((await client.query("select has_table_privilege('authenticated','public.topics','insert') as allowed")).rows[0].allowed,false)
 } finally {await client.query('rollback')}
 console.log('PASS final migration from predecessor, RLS and restricted grants')
 await client.query(fs.readFileSync('supabase/demo-topics.sql','utf8'))
 const counts=await client.query("select count(*)::int as n from public.requests where source_ref like 'SYN-%'")
 assert.equal(counts.rows[0].n,40)
 await client.query(fs.readFileSync('supabase/demo-topics.sql','utf8'))
 assert.equal((await client.query("select count(*)::int as n from public.requests where source_ref like 'SYN-%'")).rows[0].n,40)
 console.log('PASS local migration and idempotent 40-record synthetic dataset')
 await client.query('begin')
 try{
 const accounts=(await client.query("select p.id,p.role,u.email from public.profiles p join auth.users u on u.id=p.id where p.active")).rows
 const actor=email=>{const p=accounts.find(p=>p.email===email+'@kinetria.example');assert(p,email);return p}
 const admin=actor('admin'),handler=actor('handler'),manager=actor('manager'),employee=actor('employee'),customer=actor('client'),scopedManager=actor('manager-it')
 const ids=(await client.query("select id from public.requests where source_ref like 'SYN-003-%' order by id limit 2")).rows.map(r=>r.id)
 const foreign=(await client.query("select id from public.requests where source_ref like 'SYN-007-%' order by id limit 1")).rows[0].id
 const topic='33333333-3333-4333-8333-333333333333'
 const draft={id:topic,title:'Дубли артикулов',isAiGenerated:true,ticketIds:ids}
 async function as(p){await client.query("select set_config('request.jwt.claim.sub',$1,true),set_config('request.jwt.claims',$2,true)",[p.id,JSON.stringify({sub:p.id,role:'authenticated'})])}
 async function rpc(op,data={}){return (await client.query('select public.topic_service($1,$2) as result',[op,data])).rows[0].result}
 async function reject(p,op,data){await as(p);await client.query('savepoint denied');try{await rpc(op,data);assert.fail('Expected denial')}catch(error){assert(['42501','22023','PT409'].includes(error.code),error.message);await client.query('rollback to denied')}await client.query('release denied')}
 await client.query("delete from kinetria_private.manager_categories where manager_id=$1 and category_id='catalog'",[scopedManager.id])
 await reject(scopedManager,'save',draft)
 await reject(employee,'save',draft);await reject(customer,'list',{})
 await reject(handler,'save',{...draft,ticketIds:[]})
 await reject(handler,'save',{...draft,ticketIds:[ids[0]]})
 await reject(handler,'save',{...draft,ticketIds:[ids[0],foreign]})
 await reject(handler,'save',{...draft,ticketIds:[ids[0],'99999999-9999-4999-8999-999999999999']})
 await as(handler);assert.equal(await rpc('save',draft),topic);assert.equal(await rpc('save',draft),topic)
 assert.deepEqual((await rpc('list')).find(t=>t.id===topic).ticketIds,ids.sort())
 await reject(handler,'save',{...draft,title:'Changed replay'})
 await reject(handler,'delete',{id:topic});await reject(manager,'delete',{id:topic})
 await as(admin);assert((await rpc('list')).some(t=>t.id===topic))
 console.log('PASS save/replay, exact memberships, empty/fabricated/out-of-scope rejection, Admin-only deletion')
 const tg=876543210
 await client.query('delete from public.telegram_links where user_id=$1',[handler.id])
 await client.query('insert into public.telegram_links(telegram_id,user_id) values($1,$2) on conflict(telegram_id) do update set user_id=excluded.user_id',[tg,handler.id])
 const botList=(await client.query("select public.telegram_bridge($1,'topics',$2) as result",[tg,{op:'list'}])).rows[0].result
 assert(botList.some(t=>t.id===topic))
 const botDraft={...draft,id:'44444444-4444-4444-8444-444444444444',title:'Тема из Telegram'}
 await client.query("select public.telegram_bridge($1,'topics',$2)",[tg,{op:'save',data:botDraft}])
 await as(admin);assert((await rpc('list')).some(t=>t.id===botDraft.id))
 const rows=await rpc('rows');assert(rows.every(r=>r.id&&r.category_id&&r.created_at))
 const before=(await client.query('select count(*)::int as n from public.requests')).rows[0].n
 await rpc('delete',{id:topic});assert(!(await rpc('list')).some(t=>t.id===topic))
 assert.equal((await client.query('select count(*)::int as n from public.topic_requests where topic_id=$1',[topic])).rows[0].n,0)
 assert.equal((await client.query('select count(*)::int as n from public.requests')).rows[0].n,before)
 console.log('PASS web → Telegram → web shared service, deletion preserves requests')
 await as(employee);await client.query('set local role authenticated');assert.equal((await client.query('select count(*)::int as n from public.topics')).rows[0].n,0);await client.query('reset role')
 await as(handler);await client.query('set local role authenticated');assert((await client.query('select id from public.topics')).rows.some(r=>r.id===botDraft.id));await client.query('reset role')
 await as(handler)
 await client.query('update public.requests set assignee_id=$1 where id=$2',[manager.id,ids[0]])
 assert(!(await rpc('list')).some(t=>t.id===botDraft.id),'Partial scope must not expose the whole topic')
 await client.query('update public.profiles set active=false where id=$1',[handler.id])
 await reject(handler,'list',{})
 console.log('PASS direct table RLS, scope revocation and inactive profile rejection')
 }finally{await client.query('rollback')}
}
main().catch(e=>{console.error(e.message);process.exitCode=1}).finally(()=>client.end())
