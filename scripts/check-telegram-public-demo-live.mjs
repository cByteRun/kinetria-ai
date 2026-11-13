// Synthetic hosted smoke test. Telegram transport is captured, never sent.
// Creates no requests; removes only the reserved test identities/updates on exit.
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createClient } from '@supabase/supabase-js'
import ts from 'typescript'
const ref = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname.split('.')[0]
assert.equal(process.env.MIGRATION_PROJECT_REF, ref, 'Set the exact target project guard')
assert.equal(process.env.TELEGRAM_DEMO_ENABLED, 'true')
assert.equal(process.env.TELEGRAM_DEMO_RESTRICTED, 'false')
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, { auth: {persistSession:false,autoRefreshToken:false} })
const ids = [990000021,990000022], updateIds = [], messages = []
let updateId = 8900000000
const read = p => readFile(new URL('../'+p, import.meta.url), 'utf8')
const url = s => 'data:text/javascript;base64,'+Buffer.from(s).toString('base64')
const compile = s => url(ts.transpileModule(s,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText)
const { data: existing, error: checkError } = await db.from('telegram_links').select('telegram_id').in('telegram_id', ids)
assert.ifError(checkError); assert.equal(existing.length,0,'Reserved synthetic IDs already in use')
const messagesFor = id => messages.filter(m=>m.tg===id)
globalThis.publicDemoSmoke = {
 createClient, telegramDb:()=>db,
 async bridge(tg,op,data={}) {
  const r=await db.rpc('telegram_bridge',{p_tg:tg,p_op:op,p_data:data})
  if(r.error) throw new Error(r.error.code==='42501'?'unlinked':r.error.code)
  return r.data
 },
 async say(tg,text,buttons){messages.push({tg,text,buttons});return {message_id:messages.length}},
 async telegram(){return true},
 async transcribe(){throw new Error('Voice transport mocked in this smoke test')},
 async downloadTelegramFile(){throw new Error('No attachments in this smoke test')},
}
const api=url('export const {bridge,say,telegram,transcribe,downloadTelegramFile,telegramDb}=globalThis.publicDemoSmoke;')
const accounts=JSON.parse(await read('lib/demo-accounts.json'))
let demoSource=await read('lib/telegram/demo.ts')
demoSource=demoSource.replace("import accounts from '../demo-accounts.json' with { type: 'json' }",'const accounts='+JSON.stringify(accounts)).replace("'./api'",JSON.stringify(api)).replace("'@supabase/supabase-js'",JSON.stringify(url('export const {createClient}=globalThis.publicDemoSmoke;')))
let source=await read('lib/telegram/bot.ts')
const modules={
 '../telegram-links':compile(await read('lib/telegram-links.ts')),
 '../requests':compile(await read('lib/requests.ts')),
 '../ai':compile((await read('lib/ai.ts')).replace("'./ai-request'", JSON.stringify(compile(await read('lib/ai-request.ts'))))),
 './demo':compile(demoSource),'./api':api,
 '../semantic-topics':url('export const semanticTopics=()=>{throw Error("unused")};'),
 '../insights':url('export const recurringProblems=()=>{throw Error("unused")};'),
 '../qvin':url('export const askQvin=()=>{throw Error("unused")};'),
 '../enrich-request':url('export const enrichRequest=()=>{throw Error("No submission permitted")};'),
 '../request-summary':url('export const generateRequestSummary=()=>{throw Error("unused")};'),
}
for(const [name,target] of Object.entries(modules))source=source.replace("'"+name+"'",JSON.stringify(target))
const {handleUpdate}=await import(compile(source))
async function send(tg,text,callback){
 const id=++updateId;updateIds.push(id)
 const message={message_id:id,chat:{id:tg,type:'private'},from:{id:tg},text}
 await handleUpdate(callback?{update_id:id,callback_query:{id:String(id),from:{id:tg},message,data:callback}}:{update_id:id,message})
}
try{
 for(const id of ids){
  await send(id,'/start')
  assert(messagesFor(id).at(-1).text.includes('Выберите демоаккаунт'))
  await send(id,'','demo:employee')
  assert(messagesFor(id).at(-1).buttons.flat().some(b=>b.callback_data==='menu:new'))
  await send(id,'/start')
  assert(!messagesFor(id).at(-1).text.includes('Выберите демоаккаунт'))
 }
 const links=await db.from('telegram_links').select('user_id').in('telegram_id',ids)
 assert.ifError(links.error);assert.equal(links.data.length,2);assert.equal(links.data[0].user_id,links.data[1].user_id)
 await send(ids[0],'/new')
 await send(ids[0],'Синтетическая проверка. SYN-001 и SYN001 обозначают один товар в каталоге. Приходится сверять вручную. Предлагаю единый артикул.')
 const first=await globalThis.publicDemoSmoke.bridge(ids[0],'context')
 const second=await globalThis.publicDemoSmoke.bridge(ids[1],'context')
 assert.equal(first.state.draft.category,'catalog','Real AI must classify Telegram draft')
 assert(first.state.draft.tags.length>0);assert(!second.state.draft,'Second viewer must not see first draft')
 assert(!messagesFor(ids[0]).some(m=>m.text.includes('ИИ недоступен')))
 console.log('PASS hosted new viewers: /start → shared role → home, real Auth/RPC/Groq draft, isolated state; no Telegram messages or requests sent')
} finally {
 for(const table of ['telegram_links','telegram_sessions','telegram_demo_sessions']){
  const r=await db.from(table).delete().in('telegram_id',ids);assert.ifError(r.error)
 }
 if(updateIds.length){const r=await db.from('telegram_updates').delete().in('id',updateIds);assert.ifError(r.error)}
 delete globalThis.publicDemoSmoke
}
