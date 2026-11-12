import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import ts from 'typescript'
const url = s => 'data:text/javascript;base64,' + Buffer.from(s).toString('base64')
let source = await readFile(new URL('../lib/telegram/inbox.ts', import.meta.url), 'utf8')
let fail = false, completed = [], active = 0, peak = 0
const jobs = Array.from({length: 10}, (_,i) => ({id:i,token:String(i),payload:{update_id:i,message:{chat:{id:i+1,type:'private'},from:{id:i+1},text:'/home'}}}))
globalThis.inboxHarness = {
 telegramDb: () => ({rpc:async(name,args) => {
   if(name==='telegram_inbox_claim') return {data:completed.length?[]:jobs,error:null}
   if(name==='telegram_inbox_finish') {completed.push(args);return {error:null}}
   if(name==='telegram_enqueue') return {error:fail?{}:null}
   throw new Error(name)
 }}),
 handleUpdate:async update => {active++;peak=Math.max(peak,active);await new Promise(resolve=>setTimeout(resolve,5));active--;if(update.update_id===3)throw new Error('provider down')},
}
source=source.replace("'./api'",`'${url('export const {telegramDb}=globalThis.inboxHarness')}'`).replace("'./bot'",`'${url('export const {handleUpdate}=globalThis.inboxHarness')}'`)
const {parseUpdate,enqueueUpdate,drainInbox}=await import(url(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText))
for(const value of [null,{}, {update_id:-1},{update_id:1,message:{chat:{id:1,type:'private'},text:3}}, {update_id:1,callback_query:{id:'1',from:{id:1},message:{chat:{id:1,type:'private'}},data:4}}]) assert.throws(()=>parseUpdate(value))
assert.equal(await enqueueUpdate(parseUpdate({update_id:1,message:{chat:{id:-1,type:'group'}}})),false)
fail=true;await assert.rejects(()=>enqueueUpdate(jobs[0].payload),/Inbox unavailable/);fail=false
const error=console.error;console.error=()=>{}
try {assert.equal((await drainInbox()).processed,10)} finally {console.error=error}
assert.equal(peak,10);assert.equal(completed.length,10);assert.equal(completed.filter(x=>!x.p_success).length,1)
assert.equal(completed.find(x=>!x.p_success).p_id,3)
console.log('PASS inbox: runtime validation, unsupported groups, durable admission failure, 10 concurrent users, failed job retained, token receipts')
