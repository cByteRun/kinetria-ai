import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import ts from 'typescript'
const url=s=>'data:text/javascript;base64,'+Buffer.from(s).toString('base64')
let source=await readFile(new URL('../lib/telegram/api.ts',import.meta.url),'utf8')
source=source.replace("'../speech'",`'${url('export const maxVoiceBytes=3145728;export const transcribeAudio=()=>{throw new Error("Unexpected transcription")};')}'`)
source=source.replace("'./rate-limit'",`'${url('export const apiSlot=async(...args)=>{globalThis.apiRateCalls?.push(args);return 0};export const waitForApiSlot=async()=>{};')}'`)
source=source.replace("'@supabase/supabase-js'",`'${url('export const createClient=()=>globalThis.apiDbHarness;')}'`)
const {say,secretMatches,bridge,telegram}=await import(url(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText))
assert(secretMatches('abc','abc'));assert(!secretMatches('ab','abc'));assert(!secretMatches(null,'abc'));assert(!secretMatches('abc',undefined))
process.env.TELEGRAM_BOT_TOKEN='synthetic'
const messages=[]
globalThis.fetch=async(_,init)=>{messages.push(JSON.parse(init.body));return Response.json({ok:true,result:{message_id:messages.length}})}
const text='a'.repeat(3799)+'🔔'+'b'.repeat(4300)
const buttons=[[{text:'Confirm',callback_data:'confirm'}]]
await say(42,text,buttons)
assert.equal(messages.map(m=>m.text).join(''),text,'Detailed draft must not be truncated')
assert(messages.every(m=>m.text.length<=3800&&m.protect_content))
assert(messages.slice(0,-1).every(m=>m.reply_markup.inline_keyboard.length===0))
assert.deepEqual(messages.at(-1).reply_markup.inline_keyboard,buttons,'Confirmation appears after all draft content')
assert(messages.every(m=>!/[\ud800-\udbff]$/.test(m.text)&&!/^[\udc00-\udfff]/.test(m.text)),'Never split surrogate pairs')
console.log('PASS Telegram API: constant-time secret checks, complete long drafts, character limits, intact emoji, confirmation after content')
process.env.NEXT_PUBLIC_SUPABASE_URL='https://synthetic.example'
process.env.SUPABASE_SECRET_KEY='synthetic'
for(const [code,expected] of [['PT409','conflict'],['PT404','unavailable'],['22023','unavailable'],['42501','unlinked'],['','temporarily unavailable'],['57014','temporarily unavailable'],['PGRST002','temporarily unavailable'],['08006','temporarily unavailable']]){
 globalThis.apiDbHarness={rpc:async()=>({data:null,error:{code,message:'SENSITIVE internal message'}})}
 await assert.rejects(()=>bridge(42,'context'),error=>error.message.includes(expected)&&!error.message.includes('SENSITIVE'))
}
console.log('PASS RPC failures: only deterministic domain errors are acknowledged; network/gateway/timeout failures remain retryable and sanitized')
// Hosted databases may have topic storage but the older request-only bridge.
for(const role of ['admin','manager','handler','employee','client']) {
 const operations=[]
 const rows=Array.from({length:125},(_,i)=>({id:'allowed-'+i,title:'Synthetic',description:'Only authorized text',status:'new',created_at:'2026-11-13',category_id:'catalog',secret:'omit'}))
 globalThis.apiDbHarness={rpc:async(_,args)=>{
  operations.push(args)
  if(args.p_op==='qvin')return {error:{code:'PT404'}}
  if(args.p_op==='context')return {data:{role}}
  assert.equal(args.p_op,'topics');assert.deepEqual(args.p_data,{op:'rows'})
  return {data:rows}
 }}
 if(['admin','manager'].includes(role)) {
  const result=await bridge(42,'qvin')
  assert.equal(result.length,100);assert.equal(result[0].id,'allowed-0');assert.equal(result.at(-1).id,'allowed-99')
  assert(result.every(row=>!('secret' in row)))
 } else {
  await assert.rejects(()=>bridge(42,'qvin'),/unavailable/)
  assert(!operations.some(call=>call.p_op==='topics'))
 }
 assert(operations.every(call=>call.p_tg===42))
}
globalThis.apiDbHarness={rpc:async()=>({data:[{id:'native',report:{scope:'author'}}]})}
assert.equal((await bridge(42,'qvin'))[0].report.scope,'author','Native Qvin retains impact metadata')
console.log('PASS Qvin compatibility: authorized topic reader, admin/manager only, last 100, field whitelist, native metadata retained')
const edits=[]
globalThis.fetch=async(address,init)=>{edits.push({method:String(address).split('/').at(-1),...JSON.parse(init.body)});return Response.json({ok:true,result:{message_id:77}})}
await say(42,'Главная',buttons,77)
assert.equal(edits.length,1);assert.equal(edits[0].method,'editMessageText');assert.equal(edits[0].message_id,77)
for (const [description,status,count] of [['Bad Request: message is not modified',400,1],['Bad Request: message to edit not found',400,2],["Bad Request: message can't be edited",400,2],['Bad Request: BUTTON_DATA_INVALID',400,1],['Too Many Requests',429,1]]) {
 const calls=[]
 globalThis.fetch=async(address,init)=>{const method=String(address).split('/').at(-1);calls.push({method,...JSON.parse(init.body)});return method==='editMessageText' ? Response.json({ok:false,error_code:status,description},{status}) : Response.json({ok:true,result:{message_id:78}})}
 if(description.includes('BUTTON_DATA') || status===429) await assert.rejects(()=>say(42,'Экран',buttons,77))
 else await say(42,'Экран',buttons,77)
 assert.equal(calls.length,count)
 if(count===2) assert.equal(calls[1].method,'sendMessage')
}
console.log('PASS edit transport: edit target, unchanged success, deleted/expired fallback, invalid buttons and rate limits remain retryable')

// Multipart files share the exact same API path and respect provider cooldowns.
globalThis.apiRateCalls=[]
const multipart=new FormData();multipart.set('chat_id','42');multipart.set('document',new Blob(['synthetic']),'test.txt')
globalThis.fetch=async(_,init)=>{assert(init.body instanceof FormData);assert.equal(init.headers,undefined);return Response.json({ok:false,error_code:429,parameters:{retry_after:17}},{status:429})}
await assert.rejects(()=>telegram('sendDocument',multipart),/HTTP 429/)
assert.deepEqual(globalThis.apiRateCalls,[['42',17]])
console.log('PASS multipart API: common transport, provider retry_after persisted before retry')
