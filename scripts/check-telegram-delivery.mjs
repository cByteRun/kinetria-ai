import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import ts from 'typescript'
const toUrl=s=>'data:text/javascript;base64,'+Buffer.from(s).toString('base64')
const calls=[]
const rows={
 request_categories:[{id:'catalog',name_ru:'Каталог'}],
 telegram_demo_sessions:[],telegram_tokens:[],telegram_sessions:[],telegram_updates:[],telegram_channel_messages:[],
 telegram_outbox:[{id:1,request_id:'r',version:2,event:'assigned',actor_id:'manager',snapshot:{assignee_id:'handler',due_at:'2026-12-01'},done:false,delivered:{},attempts:0,next_attempt_at:'2020-01-01',leased_until:null}],
 requests:[{id:'r',number:123,category_id:'catalog',status:'review',assignee_id:'handler',author_id:'author',due_at:'2026-12-01',title:'SECRET TITLE',description:'SECRET DESCRIPTION'}],
 profiles:[{id:'manager',display_name:'Manager',active:true},{id:'handler',display_name:'Handler',active:true},{id:'other',display_name:'Other',active:true},{id:'author',display_name:'Author',active:true}],
 telegram_links:[{telegram_id:11,user_id:'author'},{telegram_id:12,user_id:'handler'},{telegram_id:13,user_id:'other'}],
}
class Query {
 constructor(table){this.table=table;this.filters=[];this.operation='select';this.one=false}
 select(){return this} eq(k,v){this.filters.push(r=>r[k]===v);return this} in(k,v){this.filters.push(r=>v.includes(r[k]));return this}
 lt(k,v){this.filters.push(r=>r[k]<v);return this} lte(k,v){this.filters.push(r=>r[k]<=v);return this} or(){return this} order(){return this} limit(){return this}
 update(data){this.operation='update';this.data=data;return this} delete(){this.operation='delete';return this} upsert(data){this.operation='upsert';this.data=data;return this}
 maybeSingle(){this.one=true;return this} single(){this.one=true;return this}
 then(ok,bad){return this.execute().then(ok,bad)}
 async execute(){
  let found=rows[this.table].filter(r=>this.filters.every(f=>f(r)))
  if(this.operation==='upsert'){rows[this.table].push({...this.data});found=[this.data]}
  if(this.operation==='update')for(const r of found)Object.assign(r,this.data)
  if(this.operation==='delete')rows[this.table]=rows[this.table].filter(r=>!found.includes(r))
  return {data:this.one?found[0]||null:found.map(r=>({...r})),error:null}
 }
}
let failHandler=true
process.env.TELEGRAM_BOT_TOKEN='synthetic';process.env.TELEGRAM_CHANNEL_ID='-100123';process.env.TELEGRAM_BOT_USERNAME='synthetic_bot'
globalThis.deliveryHarness={
 telegramDb:()=>({from:table=>new Query(table)}),
 async say(chat,text){
  if((chat===11&&globalThis.deliveryHarness.failAuthor)||(chat==='-100123'&&globalThis.deliveryHarness.failChannel))throw new Error('Synthetic destination failure')
  if(chat===12&&failHandler){failHandler=false;throw new Error('Synthetic network failure')}
  calls.push({method:'send',chat,text});return {message_id:calls.length}
 },
 async telegram(method,body){if(globalThis.deliveryHarness.failChannel)throw new Error('Synthetic channel failure');calls.push({method,...body});return true},
}
let source=await readFile(new URL('../lib/telegram/delivery.ts',import.meta.url),'utf8')
const api=toUrl('export const {telegramDb,say,telegram}=globalThis.deliveryHarness;')
source=source.replace("'./api'",`'${api}'`)
const {deliverOutbox,channelText}=await import(toUrl(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText))
assert(!channelText(rows.requests[0]).includes('SECRET'))
assert.deepEqual(await deliverOutbox(),{sent:0})
assert.equal(rows.telegram_outbox[0].done,false)
assert(rows.telegram_outbox[0].next_attempt_at>new Date().toISOString(),'Failure must schedule a backoff')
assert.equal(calls.filter(c=>c.chat===11).length,1)
assert.equal(calls.filter(c=>c.chat===13).length,0,'Unassigned handler must not receive personal notifications')
assert.equal(rows.telegram_outbox[0].delivered.channel,true)
assert.equal(rows.telegram_outbox[0].delivered.author,true)
rows.telegram_outbox[0].next_attempt_at='2020-01-01'
assert.deepEqual(await deliverOutbox(),{sent:1})
assert.equal(rows.telegram_outbox[0].done,true)
assert.equal(calls.filter(c=>c.chat===11).length,1,'Do not repeat successful author notification on retry')
assert.equal(calls.filter(c=>c.chat===12).length,1)
assert.equal(calls.filter(c=>c.chat==='-100123').length,2,'Original channel card + assignment event, no duplicates on retry')
assert(!calls.some(c=>JSON.stringify(c).includes('SECRET')))
assert.deepEqual(await deliverOutbox(),{sent:0},'Completed job must not be replayed')
// A channel outage must not prevent the closed loop in private chats, and a
// blocked author must not prevent the current assignee's notification.
rows.telegram_outbox.push({id:2,request_id:'r',version:3,event:'status',actor_id:'handler',snapshot:{},done:false,delivered:{},attempts:0,next_attempt_at:'2020-01-01',leased_until:null})
globalThis.deliveryHarness.failChannel=true
globalThis.deliveryHarness.failAuthor=true
const beforeHandler=calls.filter(c=>c.chat===12).length
assert.deepEqual(await deliverOutbox(),{sent:0})
assert.equal(calls.filter(c=>c.chat===12).length,beforeHandler+1)
assert.equal(rows.telegram_outbox[1].delivered.handler,true)
assert(!rows.telegram_outbox[1].delivered.author)
assert(!rows.telegram_outbox[1].delivered.channel)
globalThis.deliveryHarness.failChannel=false
globalThis.deliveryHarness.failAuthor=false
rows.telegram_outbox[1].next_attempt_at='2020-01-01'
assert.deepEqual(await deliverOutbox(),{sent:1})
assert.equal(calls.filter(c=>c.chat===12).length,beforeHandler+1,'Successful assignee must not be repeated while retrying channel/author')
assert.equal(rows.telegram_outbox[1].done,true)
console.log('PASS Telegram delivery: safe channel fields, assignment event, author/current-assignee-only, partial receipts, backoff, retry without repeating successful sends')
console.log('PASS independent destinations: channel/author failures do not block assignee; retries preserve successful receipts')
