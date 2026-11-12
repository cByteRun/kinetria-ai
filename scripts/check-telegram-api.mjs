import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import ts from 'typescript'
const url=s=>'data:text/javascript;base64,'+Buffer.from(s).toString('base64')
let source=await readFile(new URL('../lib/telegram/api.ts',import.meta.url),'utf8')
source=source.replace("'@supabase/supabase-js'",`'${url('export const createClient=()=>{throw new Error("DB must not be called")};')}'`)
const {say,secretMatches}=await import(url(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText))
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
