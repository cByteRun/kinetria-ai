import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import ts from 'typescript'
const url = source => 'data:text/javascript;base64,' + Buffer.from(source).toString('base64')
const transpile = source => ts.transpileModule(source, { compilerOptions: { module:ts.ModuleKind.ESNext, target:ts.ScriptTarget.ES2022 } }).outputText
const requests = url(transpile(await readFile(new URL('../lib/requests.ts', import.meta.url), 'utf8')))
const messages = [], calls = [], states = new Map(), updates = new Set()
let currentRole = 'employee'
let listRows = []
globalThis.telegramHarness = {
  async bridge(tg, op, data = {}) {
    calls.push({tg,op,data})
    if (op === 'claim') { if (updates.has(data.update)) return false; updates.add(data.update); return true }
    if (op === 'context') return {role: currentRole,name:'Synthetic account',state:states.get(tg) || {},categories:[{id:'catalog',name:'Каталог'}]}
    if (op === 'state') { states.set(tg,data); return true }
    if (op === 'submit') return {id:'f0000000-0000-4000-8000-000000000000',number:123}
    if (op === 'finish') return true
    if (['list','stats'].includes(op)) return listRows
    throw new Error('Unexpected bridge operation: ' + op)
  },
  async say(tg,text,buttons) { messages.push({tg,text,buttons}); return {message_id:messages.length} },
  async telegram() {return true}, async transcribe() {throw new Error('Speech unavailable')}, async downloadTelegramFile() {return Buffer.from('test')},
}
const api = url(`export const {bridge,say,telegram,transcribe,downloadTelegramFile} = globalThis.telegramHarness;`)
const accounts = JSON.parse(await readFile(new URL('../lib/demo-accounts.json', import.meta.url), 'utf8')).filter(a=>a.role!=='client')
const demo = url(`export const demoChoices=${JSON.stringify(accounts)}; export const demoAllowed=tg=>Boolean(globalThis.telegramHarness.demoEnabled)&&tg===42; export const switchDemoAccount=(tg,id)=>globalThis.telegramHarness.switchDemo(tg,id);`)
const ai = url(`export const aiConfig=()=>null; export const generateText=()=>{throw new Error('Unexpected model call')};`)
let source = await readFile(new URL('../lib/telegram/bot.ts', import.meta.url), 'utf8')
source = source.replace("'./demo'", `'${demo}'`).replace("'../ai'", `'${ai}'`).replace("'./api'", `'${api}'`).replace("'../requests'", `'${requests}'`)
const {handleUpdate} = await import(url(transpile(source)))
let n=0
const send = async(text, extra={}) => handleUpdate({update_id:++n,message:{chat:{id:42,type:'private'},from:{id:42},text,...extra}})
const callback = async(data) => handleUpdate({update_id:++n,callback_query:{id:String(n),from:{id:42},message:{chat:{id:42,type:'private'}},data}})
await send('/new')
assert.equal(states.get(42).mode,'compose')
await send('В каталоге SYN-001 и SYN001 приходится сверять вручную. Нужен единый артикул.')
assert.equal(states.get(42).draft.category,'','Uncertain category requires manual choice')
assert(states.get(42).draft.description.includes('SYN001'))
assert(!calls.some(c=>c.op==='submit'),'Draft must not register before confirmation')
await callback('submit:'+states.get(42).key)
assert(!calls.some(c=>c.op==='submit'),'Category must be selected')
await callback('cat:0')
await callback('edit:title')
await send('Дубли артикула SYN-001')
assert.equal(states.get(42).draft.title,'Дубли артикула SYN-001')
await callback('edit:proposal'); await send('Согласовать канонический артикул')
await send('',{document:{file_id:'synthetic',file_name:'evidence.txt',file_size:4}})
assert.equal(states.get(42).files[0].content,'dGVzdA==')
const key=states.get(42).key
await callback('submit:'+key)
assert.equal(calls.filter(c=>c.op==='submit').length,1)
assert.equal(states.get(42).mode,'submitted')
await callback('submit:'+key)
assert.equal(calls.filter(c=>c.op==='submit').length,1,'Stale submit button must not submit again')
const before=messages.length
await handleUpdate({update_id:n,message:{chat:{id:42,type:'private'},from:{id:42},text:'/new'}})
assert.equal(messages.length,before,'Duplicate webhook must not repeat side effects')
await send('/new'); await send('',{voice:{file_id:'voice',duration:121}})
assert(messages.at(-1).text.includes('120'))
await send('',{voice:{file_id:'voice',duration:15}})
assert(messages.at(-1).text.includes('Отправьте текст'),'Speech outage must offer text fallback')
currentRole='handler'; await send('/new')
assert(messages.at(-1).text.includes('сотруднику'))
const beforeCalls=calls.length
await handleUpdate({update_id:++n,message:{chat:{id:-123,type:'group'},from:{id:42},text:'/list'}})
assert.equal(calls.length,beforeCalls,'No employee data in group chats')
globalThis.telegramHarness.demoEnabled=true
globalThis.telegramHarness.switchDemo=async(tg,id)=>{assert.equal(tg,42);const account=accounts.find(a=>a.id===id);assert(account);currentRole=account.role;return {name:account.name,role:account.role}}
await send('/demo');assert.equal(messages.at(-1).buttons.length,8)
await callback('demo:manager-it');assert.equal(currentRole,'manager');assert(messages.at(-1).text.includes('Максим Ли'));assert(messages.at(-1).buttons.some(row=>row.some(b=>b.callback_data==='demoMenu')))
await callback('demoMenu');assert.equal(messages.at(-1).buttons.length,8)
await callback('demo:admin');assert.equal(currentRole,'admin');assert(messages.at(-1).buttons.some(row=>row.some(b=>b.callback_data==='menu:reserve')))
await callback('demo:employee');assert.equal(currentRole,'employee');assert(messages.at(-1).buttons.some(row=>row.some(b=>b.callback_data==='menu:draft')))
console.log('PASS Telegram demo dialog: website account menu, named greeting, manager/admin/employee actions, return to account picker')
console.log('PASS Telegram transport: draft confirmation, manual category/editing, attachments, stale submit, duplicate update, voice limits/fallback, role guard, private chats only')

process.env.APP_URL='https://idearoute.example/path'
listRows=[{id:'new',number:12,status:'new',title:'Newest'}, {id:'old',number:11,status:'review',title:'Older'}]
await send('/list')
assert.deepEqual(messages.at(-1).buttons.slice(0,2).map(row=>row[0].callback_data),['open:old','open:new'])
assert.equal(messages.at(-1).buttons.at(-1)[0].url,'https://idearoute.example/login')
await send('/demo')
assert.equal(messages.at(-1).buttons.at(-1)[0].url,'https://idearoute.example/login')
process.env.APP_URL='javascript:alert(1)'
await send('/list')
assert(!messages.at(-1).buttons.some(row=>row.some(b=>b.url)))
delete process.env.APP_URL
console.log('PASS Telegram list: newest at bottom, website login link, unsafe URL excluded')

process.env.APP_URL='https://idearoute.example'
for (const [account, role, scope] of [['employee','employee','только ваши записи'],['handler','handler','назначенные вам'],['manager-it','manager','вашего направления'],['admin','admin','общего внутреннего реестра']]) {
 await callback('demo:'+account)
 assert.equal(currentRole,role)
 assert(messages.at(-1).buttons.flat().some(b=>b.callback_data==='help'))
 assert(messages.at(-1).buttons.flat().some(b=>b.url==='https://idearoute.example/login'))
 const saved=JSON.stringify(states.get(42))
 await callback('help')
 assert(messages.at(-1).text.includes(scope))
 assert.equal(JSON.stringify(states.get(42)),saved,'Help must preserve the current draft/action')
 assert(messages.at(-1).buttons.flat().some(b=>b.url==='https://idearoute.example/login'))
 await send('/help');assert(messages.at(-1).text.includes(scope))
 await send('/stats');assert(messages.at(-1).buttons.flat().some(b=>b.url==='https://idearoute.example/login'))
}
globalThis.telegramHarness.demoEnabled=false
currentRole='handler';await send('/start');assert(messages.at(-1).text.includes('назначенные вам'))
console.log('PASS role instructions: all four roles, current identity scope, draft preserved, help and dashboard links for demo/linked accounts and stats')
