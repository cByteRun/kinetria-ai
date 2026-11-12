// Creates ONE clearly labelled synthetic case; retains it as demo evidence.
// Uses real employee/manager/handler JWTs and actual channel delivery.
import assert from 'node:assert/strict'
import {randomUUID} from 'node:crypto'
import {mkdir,writeFile} from 'node:fs/promises'
import {createClient} from '@supabase/supabase-js'
import {loadTelegramRuntime} from './telegram-runtime.mjs'
const {deliverOutbox}=await loadTelegramRuntime()
const clients={}
for(const role of ['employee','manager-it','handler','handler-catalog']){
 const db=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}})
 const {data,error}=await db.auth.signInWithPassword({email:role+'@kinetria.example',password:process.env.KINETRIA_DEMO_PASSWORD})
 assert.equal(error,null,'Login '+role);clients[role]={db,id:data.user.id}
}
const report={startedAt:new Date().toISOString(),checks:[],channel:'configured private channel',mode:'synthetic common-registry/API and real Telegram delivery; not a human bot click-through'}
const check=name=>{report.checks.push(name);console.log('PASS',name)}
async function rpc(role,name,args){const r=await clients[role].db.rpc(name,args);assert.equal(r.error,null,name);return r.data}
async function row(role,id){const r=await clients[role].db.from('requests').select('*').eq('id',id).single();assert.equal(r.error,null);return r.data}
async function drain(){for(let i=0;i<4;i++){const result=await deliverOutbox();if(!result.sent)break}}
const key=randomUUID()
const input={p_key:key,p_category:'catalog',p_kind:'problem',p_title:'[P1 тест] Единый артикул SYN-001',p_description:'Синтетическая проверка интеграции: SYN-001 и SYN001 обозначают один товар. Сотрудники вручную сверяют обозначения. Реальных данных нет.',p_proposal:'Согласовать канонический артикул и алиас.',p_sentiment:5,p_tags:['p1-live-'+Date.now(),'справочник'],p_files:[{name:'p1-synthetic.txt',size:4,content:'dGVzdA=='}]}
const id=await rpc('employee','submit_with_files',input)
assert.equal(await rpc('employee','submit_with_files',input),id)
let r=await row('employee',id)
report.id=id;report.number='R-'+String(r.number).padStart(3,'0')
check('Synthetic request registered once: '+report.number)
await drain()
await rpc('manager-it','review_request',{p_id:id,p_version:r.version,p_action:'assigned',p_status:null,p_message:'',p_next_step:'',p_assignee:clients.handler.id})
r=await row('manager-it',id)
await rpc('manager-it','dashboard_action',{p_id:id,p_version:r.version,p_action:'metadata',p_message:'',p_priority:'normal',p_due:'2026-11-16',p_assignee:null})
await drain();check('Real assignment/deadline persisted and channel updated')
const revoked=await clients['handler-catalog'].db.from('requests').select('id').eq('id',id)
assert.equal(revoked.error,null);assert.equal(revoked.data.length,0);check('Previous handler cannot read reassigned case')
r=await row('handler',id)
await rpc('handler','review_request',{p_id:id,p_version:r.version,p_action:'reviewed',p_status:'review',p_message:'',p_next_step:'',p_assignee:null})
r=await row('handler',id)
await rpc('handler','review_request',{p_id:id,p_version:r.version,p_action:'reviewed',p_status:'implemented',p_message:'Синтетический результат: для тестового каталога согласован SYN-001, SYN001 сохранён как алиас. Производственные системы не изменялись.',p_next_step:'',p_assignee:null})
await drain();check('Recorded relevant outcome and real author/channel notification')
r=await row('employee',id)
await rpc('employee','dashboard_action',{p_id:id,p_version:r.version,p_action:'acknowledged',p_message:'',p_priority:'normal',p_due:null,p_assignee:null})
await drain()
r=await row('employee',id);assert(r.acknowledged_at&&r.decision)
const service=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SECRET_KEY,{auth:{persistSession:false}})
const jobs=await service.from('telegram_outbox').select('event,done,delivered').eq('request_id',id)
assert.equal(jobs.error,null);assert(jobs.data.length>=5);assert(jobs.data.every(j=>j.done),'All live case jobs delivered')
const channel=await service.from('telegram_channel_messages').select('message_id').eq('request_id',id).single()
assert.equal(channel.error,null);report.channel_message_id=channel.data.message_id
check('Author acknowledgement and all case outbox jobs delivered')
report.finishedAt=new Date().toISOString();await mkdir('docs/evidence/p1',{recursive:true});await writeFile('docs/evidence/p1/live-workflow.json',JSON.stringify(report,null,2))
console.log('LIVE CASE',report.number,'channel_message_id='+report.channel_message_id)
