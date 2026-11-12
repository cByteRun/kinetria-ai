import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import vm from 'node:vm'
import ts from 'typescript'
const url=s=>'data:text/javascript;base64,'+Buffer.from(s).toString('base64')
const transpile=s=>ts.transpileModule(s,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText
let handled=0, deliveries=0, failure, dbError=false
const afterTasks=[]
globalThis.webhookHarness={
 after:task=>afterTasks.push(task),
 secretMatches:(actual,expected)=>!!expected&&actual===expected,
 telegram:async()=>({username:'synthetic_bot'}),
 telegramDb:()=>({from:()=>({select:()=>({limit:async()=>({error:dbError})})})}),
 handleUpdate:async()=>{handled++;if(failure)throw new Error(failure)},
 deliverOutbox:async()=>{deliveries++},
}
let source=await readFile(new URL('../app/api/telegram/webhook/route.ts',import.meta.url),'utf8')
for(const [specifier,exports] of [['next/server','after'],['../../../../lib/telegram/api','secretMatches,telegram,telegramDb'],['../../../../lib/telegram/bot','handleUpdate'],['../../../../lib/telegram/delivery','deliverOutbox']])source=source.replace("'"+specifier+"'","'"+url('export const {'+exports+'}=globalThis.webhookHarness;')+"'")
const {POST,GET}=await import(url(transpile(source)))
process.env.TELEGRAM_WEBHOOK_SECRET='synthetic-secret'
const request=(body,secret='synthetic-secret')=>new Request('https://app.example/api/telegram/webhook',{method:'POST',headers:{'x-telegram-bot-api-secret-token':secret},body})
assert.equal((await POST(request('{"update_id":1}','wrong'))).status,401)
assert.equal(handled,0)
for(const body of ['null','{}','{"update_id":-1}','invalid'])assert.equal((await POST(request(body))).status,400)
assert.equal((await POST(request('a'.repeat(65537)))).status,413)
assert.equal((await POST(request('{"update_id":1}'))).status,200)
assert.equal(handled,1);assert.equal(deliveries,0)
await afterTasks.pop()();assert.equal(deliveries,1)
const originalError=console.error;console.error=()=>{}
failure='busy';assert.equal((await POST(request('{"update_id":2}'))).status,503)
failure='failure with sensitive data';const failed=await POST(request('{"update_id":3}'))
assert.equal(failed.status,503);assert.equal(failed.headers.get('X-IdeaRoute-Error'),'processing failed')
console.error=originalError
assert.equal((await GET(new Request('https://app.example'))).status,401)
const probe=()=>GET(new Request('https://app.example',{headers:{'x-telegram-bot-api-secret-token':'synthetic-secret'}}))
assert.equal((await (await probe()).json()).database,'ready')
dbError=true;assert.equal((await probe()).status,502)
console.log('PASS webhook route: authentication, invalid/oversized bodies, awaited handling, retry on busy/failure, sanitized errors, outbox scheduling, database probe')

const setup=await readFile(new URL('./setup-telegram.mjs',import.meta.url),'utf8')
async function setupRun({healthy=true,match=true}={}) {
 const calls=[]
 const context=vm.createContext({URL,AbortSignal,console:{log(){}},process:{argv:['node','setup'],env:{APP_URL:'https://app.example',TELEGRAM_BOT_TOKEN:'synthetic',TELEGRAM_WEBHOOK_SECRET:'a'.repeat(24),TELEGRAM_CHANNEL_ID:'-1001'}},fetch:async(target,options)=>{
  if(target==='https://app.example/api/telegram/webhook'){calls.push('probe');return Response.json({ok:healthy,username:'synthetic_bot',database:healthy?'ready':'unavailable'},{status:healthy?200:502})}
  const method=target.split('/').at(-1);calls.push(method)
  const body=JSON.parse(options.body)
  if(method==='setMyCommands') { globalThis.registeredTestCommands=body.commands; for (const command of ['start','new','help','demo','login','switch']) assert(body.commands.some(c=>c.command===command)); assert(body.commands.some(c=>c.command==='home')); assert(body.commands.some(c=>c.command==='draft')); assert(body.commands.some(c=>c.command==='reserve')) }
  const results={getMe:{id:1,username:'synthetic_bot'},getChat:{type:'channel'},getChatMember:{status:'administrator',can_post_messages:true,can_edit_messages:true},setMyCommands:true,getMyCommands:globalThis.registeredTestCommands,setWebhook:true,getWebhookInfo:{url:match?'https://app.example/api/telegram/webhook':'https://wrong.example',max_connections:1}}
  if(method==='setWebhook'){assert.equal(body.secret_token,'a'.repeat(24));assert.equal(body.max_connections,1);assert(!body.drop_pending_updates)}
  return Response.json({ok:true,result:results[method]})
 }})
 try {await vm.runInContext('(async()=>{'+setup+'})()',context);return {calls}}catch(error){return {calls,error}}
}
let result=await setupRun();assert(!result.error);assert.equal(result.calls[0],'probe');assert.equal(result.calls.at(-1),'getWebhookInfo')
result=await setupRun({healthy:false});assert(result.error);assert(!result.calls.includes('setWebhook'),'Never switch Telegram to an unhealthy deployment')
result=await setupRun({match:false});assert(result.error)
console.log('PASS webhook setup: APP_URL default, health before registration, secret and serialized delivery, no dropped updates, registration readback')

let delivered=0
globalThis.webhookHarness.deliverOutbox=async()=>{delivered++;return {sent:1}}
let worker=await readFile(new URL('../app/api/telegram/deliver/route.ts',import.meta.url),'utf8')
worker=worker.replace("'../../../../lib/telegram/api'","'"+url('export const {secretMatches}=globalThis.webhookHarness;')+"'")
worker=worker.replace("'../../../../lib/telegram/delivery'","'"+url('export const deliverOutbox=(...args)=>globalThis.webhookHarness.deliverOutbox(...args);')+"'")
const deliveryRoute=await import(url(transpile(worker)))
delete process.env.CRON_SECRET
assert.equal((await deliveryRoute.GET(new Request('https://app.example/api/telegram/deliver'))).status,401)
process.env.CRON_SECRET='synthetic-cron-secret'
for(const method of ['GET','POST']){
 assert.equal((await deliveryRoute[method](new Request('https://app.example/api/telegram/deliver',{method,headers:{authorization:'Bearer wrong'}}))).status,401)
 assert.equal((await deliveryRoute[method](new Request('https://app.example/api/telegram/deliver',{method,headers:{authorization:'Bearer synthetic-cron-secret'}}))).status,200)
}
assert.equal(delivered,2,'Only authenticated scheduler requests may drain the outbox')
console.log('PASS scheduler delivery endpoint: authenticated GET/POST, missing/wrong secrets denied')
