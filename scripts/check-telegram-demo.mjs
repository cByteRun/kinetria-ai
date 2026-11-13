import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import ts from 'typescript'
const url=s=>'data:text/javascript;base64,'+Buffer.from(s).toString('base64')
const accounts=JSON.parse(await readFile(new URL('../lib/demo-accounts.json',import.meta.url),'utf8'))
const calls=[]
globalThis.demoHarness={
 createClient:()=>({auth:{async signInWithPassword(input){calls.push(input.email);return {data:{user:{id:'synthetic-user'}},error:globalThis.demoHarness.authError||null}},async signOut(){return {error:null}}}}),
 telegramDb:()=>({async rpc(name,args){assert.equal(name,'telegram_demo_login');assert.equal(args.p_tg,42);assert.equal(args.p_user,'synthetic-user');return {data:{name:'Synthetic employee',role:globalThis.demoHarness.roleOverride||'employee'},error:globalThis.demoHarness.rpcError||null}}}),
}
let source=await readFile(new URL('../lib/telegram/demo.ts',import.meta.url),'utf8')
source=source.replace("import accounts from '../demo-accounts.json' with { type: 'json' }",'const accounts='+JSON.stringify(accounts))
source=source.replace("'@supabase/supabase-js'",`'${url('export const {createClient}=globalThis.demoHarness;')}'`).replace("'./api'",`'${url('export const {telegramDb}=globalThis.demoHarness;')}'`)
const {demoAllowed,demoChoices,switchDemoAccount}=await import(url(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText))
delete process.env.TELEGRAM_DEMO_ENABLED;process.env.TELEGRAM_DEMO_ALLOWED_IDS='42'
assert.equal(demoAllowed(42),false,'Must be explicitly enabled')
process.env.TELEGRAM_DEMO_ENABLED='true'
assert.equal(demoAllowed(42),true);assert.equal(demoAllowed(43),false)
process.env.TELEGRAM_DEMO_RESTRICTED='false'
assert.equal(demoAllowed(43),true,'Public demo admits new Telegram users')
assert.equal(demoAllowed(-1),false);assert.equal(demoAllowed(NaN),false)
process.env.TELEGRAM_DEMO_RESTRICTED='true'
assert.equal(demoAllowed(43),false)
assert(demoChoices.some(a=>a.role==='client'));assert.equal(demoChoices.length,accounts.length)
await assert.rejects(()=>switchDemoAccount(43,'admin'))
await assert.rejects(()=>switchDemoAccount(42,'employee'))
await assert.rejects(()=>switchDemoAccount(42,'not-an-account'))
assert.equal(calls.length,0,'Denied identity/account must not authenticate')
process.env.KINETRIA_DEMO_PASSWORD='synthetic-password'
const result=await switchDemoAccount(42,'employee')
assert.equal(result.role,'employee');assert.deepEqual(calls,['employee@kinetria.example'])
globalThis.demoHarness.roleOverride='client'
assert.equal((await switchDemoAccount(42,'client')).role,'client');assert.equal(calls.at(-1),'client@kinetria.example')
globalThis.demoHarness.roleOverride=undefined
globalThis.demoHarness.authError={status:503}
await assert.rejects(()=>switchDemoAccount(42,'employee'),/temporarily unavailable/)
globalThis.demoHarness.authError={status:400}
await assert.rejects(()=>switchDemoAccount(42,'employee'),/^Error: unavailable$/)
globalThis.demoHarness.authError=null
globalThis.demoHarness.rpcError={code:'PGRST002'}
await assert.rejects(()=>switchDemoAccount(42,'employee'),/temporarily unavailable/)
globalThis.demoHarness.rpcError={code:'PT409'}
await assert.rejects(()=>switchDemoAccount(42,'employee'),/demoBusy/)
console.log('PASS Telegram demo: disabled by default, Telegram allowlist, same website accounts including isolated client, no arbitrary login, real Auth identity passed to service RPC')
