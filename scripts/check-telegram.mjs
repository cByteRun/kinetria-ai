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
    if (op === 'detail' && globalThis.telegramHarness.detailOverride) return globalThis.telegramHarness.detailOverride()
    if (op === 'state') { states.set(tg,data); return true }
    if (op === 'submit') return {id:'f0000000-0000-4000-8000-000000000000',number:123}
    if (op === 'finish') return true
    if (['list','stats'].includes(op)) return listRows
    throw new Error('Unexpected bridge operation: ' + op)
  },
  async say(tg,text,buttons,messageId) { messages.push({tg,text,buttons,messageId}); return {message_id:messages.length} },
  async telegram() {return true}, async transcribe() {throw new Error('Speech unavailable')}, async downloadTelegramFile() {return Buffer.from('test')},
}
const api = url(`export const {bridge,say,telegram,transcribe,downloadTelegramFile} = globalThis.telegramHarness;`)
const accounts = JSON.parse(await readFile(new URL('../lib/demo-accounts.json', import.meta.url), 'utf8')).filter(a=>a.role!=='client')
const demo = url(`export const demoChoices=${JSON.stringify(accounts)}; export const demoAllowed=tg=>Boolean(globalThis.telegramHarness.demoEnabled)&&tg===42; export const switchDemoAccount=(tg,id)=>globalThis.telegramHarness.switchDemo(tg,id);`)
const ai = url(`export const aiConfig=()=>globalThis.telegramHarness.aiEnabled ? {provider:"groq"} : null; export const generateText=()=>{throw new Error('Unexpected model call')};`)
let source = await readFile(new URL('../lib/telegram/bot.ts', import.meta.url), 'utf8')
const summary = url(`export const generateRequestSummary=(...args)=>globalThis.telegramHarness.summary(...args);`)
source = source.replace("'../request-summary'", `'${summary}'`).replace("'./demo'", `'${demo}'`).replace("'../ai'", `'${ai}'`).replace("'./api'", `'${api}'`).replace("'../requests'", `'${requests}'`)
const {handleUpdate} = await import(url(transpile(source)))
let n=0
const send = async(text, extra={}) => handleUpdate({update_id:++n,message:{chat:{id:42,type:'private'},from:{id:42},text,...extra}})
const callback = async(data) => handleUpdate({update_id:++n,callback_query:{id:String(n),from:{id:42},message:{message_id:77,chat:{id:42,type:'private'}},data}})
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
await send('/demo');assert.equal(messages.at(-1).buttons.length,9)
await callback('demo:manager-it');assert.equal(currentRole,'manager');assert(messages.at(-1).text.includes('Максим Ли'));assert(messages.at(-1).text.includes('Выбрана роль: Руководитель'));assert.equal(messages.at(-1).messageId,77)
await callback('demoMenu');assert.equal(messages.at(-1).buttons.length,9)
await callback('demo:admin');assert.equal(currentRole,'admin');assert(messages.at(-1).text.includes('/reserve —'))
await callback('demo:employee');assert.equal(currentRole,'employee');assert(messages.at(-1).text.includes('/draft —'))
console.log('PASS Telegram demo dialog: website account menu, named greeting, manager/admin/employee actions, return to account picker')
console.log('PASS Telegram transport: draft confirmation, manual category/editing, attachments, stale submit, duplicate update, voice limits/fallback, role guard, private chats only')

process.env.APP_URL='https://idearoute.example/path'
listRows=[{id:'new',number:12,status:'new',title:'Newest'}, {id:'old',number:11,status:'review',title:'Older'}]
await send('/list')
assert.deepEqual(messages.at(-1).buttons.slice(0,2).map(row=>row[0].callback_data),['open:old','open:new'])
assert.equal(messages.at(-1).buttons.flat().find(b=>b.url)?.url,'https://idearoute.example/login')
await send('/demo')
assert.equal(messages.at(-1).buttons.flat().find(b=>b.url)?.url,'https://idearoute.example/login')
process.env.APP_URL='javascript:alert(1)'
await send('/list')
assert(!messages.at(-1).buttons.some(row=>row.some(b=>b.url)))
delete process.env.APP_URL
console.log('PASS Telegram list: newest at bottom, website login link, unsafe URL excluded')

process.env.APP_URL='https://idearoute.example'
for (const [account, role, scope] of [['employee','employee','только ваши записи'],['handler','handler','назначенные вам'],['manager-it','manager','вашего направления'],['admin','admin','общего внутреннего реестра']]) {
 await callback('demo:'+account)
 assert.equal(currentRole,role)
 assert(!messages.at(-1).text.includes('IdeaRoute'))
 await callback('menu:home')
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
currentRole='handler';await send('/start');assert(messages.at(-1).text.includes('Ответственный'))
const savedState=structuredClone(states.get(42))
for (const command of ['/home','/help','/start']) {
 await send(command); assert.deepEqual(states.get(42),savedState); assert.equal(currentRole,'handler')
 assert(messages.at(-1).buttons.flat().some(b=>b.callback_data==='menu:home'))
}
await callback('menu:home');assert.deepEqual(states.get(42),savedState)
assert(messages.at(-1).text.includes('одними обращениями'))
assert(!messages.at(-1).buttons.flat().some(b=>b.callback_data==='demoMenu'))
globalThis.telegramHarness.demoEnabled=true
await send('/start');assert(messages.at(-1).text.includes('/login'));assert.equal(currentRole,'handler')
console.log('PASS role instructions: all four roles, current identity scope, draft preserved, help and dashboard links for demo/linked accounts and stats')

currentRole='employee'
await send('/new')
assert(messages.at(-1).text.includes('📌 Тип на выбор'))
await send('Проблема в каталоге SYN-002')
assert(!/\p{Extended_Pictographic}/u.test(messages.at(-1).text))
for (const label of ['Текст обращения','Метаданные','Тип:','Категория:','Теги:','Проверьте текст, тип и категорию']) assert(messages.at(-1).text.includes(label))
await callback('kind'); assert.equal(states.get(42).draft.kind,'problem')
await callback('kind:idea'); assert.equal(states.get(42).draft.kind,'idea'); assert.equal(messages.at(-1).messageId,77)
const original=structuredClone(states.get(42))
await callback('rewrite'); assert.equal(states.get(42).mode,'compose'); assert.deepEqual(states.get(42).draft,original.draft)
await send('',{voice:{file_id:'voice',duration:10}}); assert.deepEqual(states.get(42).draft,original.draft)
await callback('menu:draft'); assert.equal(states.get(42).mode,'draft')
await callback('rewrite'); await send('Предложение: обновить каталог SYN-003')
assert.notEqual(states.get(42).key,original.key); assert(states.get(42).draft.description.includes('SYN-003'))
await callback('submit:'+original.key); assert.equal(calls.filter(c=>c.op==='submit').length,1)
await send('/help'); assert(!messages.at(-1).text.includes('IdeaRoute')); assert.equal(messages.at(-1).messageId,undefined)
console.log('PASS UX: explicit type picker, plain preview, rewrite recovery/replacement, stale confirmation, callback edit targets, help without project introduction')

await Promise.all(['menu:home','help'].map((data,index)=>handleUpdate({update_id:++n,callback_query:{id:String(n),from:{id:42},message:{message_id:101+index,chat:{id:42,type:'private'}},data}})))
const concurrent=messages.slice(-2)
assert.equal(concurrent.find(m=>m.text.includes('Доступные сценарии')).messageId,102)
assert.equal(concurrent.find(m=>m.text.includes('IdeaRoute')).messageId,101)
console.log('PASS navigation isolation: overlapping updates keep their own edit targets')

currentRole='employee'
await send('/new'); await send('Нужен единый каталог'); await callback('cat:0')
const preserved = structuredClone(states.get(42).draft)
for (const action of ['edit:title','edit:description','edit:tags','edit:proposal','kind','category','attach']) {
 await callback(action)
 assert(messages.at(-1).buttons.flat().some(b=>b.text==='⬅️ Назад' && b.callback_data==='menu:draft'))
 await callback('menu:draft')
 assert.equal(states.get(42).mode,'draft'); assert.equal(states.get(42).field,undefined)
 assert.deepEqual(states.get(42).draft,preserved)
}
await send('Не должно изменить черновик'); assert.deepEqual(states.get(42).draft,preserved)
await callback('attach'); await send('',{document:{file_id:'pdf',file_name:'plan.pdf',file_size:4}})
assert.equal(states.get(42).mode,'draft'); assert(messages.at(-1).text.includes('plan.pdf'))
assert(messages.at(-1).buttons.flat().every(b=>/\p{Extended_Pictographic}/u.test(b.text)))
const preview=messages.at(-1)
assert(preview.buttons.findIndex(row=>row.some(b=>b.callback_data==='attach')) < preview.buttons.findIndex(row=>row.some(b=>b.callback_data.startsWith('submit:'))))
await callback('attach'); await send('',{document:{file_id:'big',file_name:'big.pdf',file_size:1048577}})
assert.equal(states.get(42).files.length,1)
await callback('menu:draft'); await send('',{photo:[{file_id:'photo',file_size:4}]})
assert.equal(states.get(42).files.length,2)
await send('',{document:{file_id:'docx',file_name:'plan.docx',file_size:4}})
await send('',{document:{file_id:'fourth',file_name:'fourth.pdf',file_size:4}})
assert.equal(states.get(42).files.length,3)
await callback('submit:'+states.get(42).key)
assert.equal(calls.filter(c=>c.op==='submit').at(-1).data.files.length,3)
console.log('PASS editor back/reset, attachment names, PDF/DOCX/photo, size/count limits and submission payload')

// AI summaries: callback RBAC, bridge visibility, retry and inert plain text.
const summaryId='f0000000-0000-4000-8000-000000000000'
let summaryCalls=0, denyDetail=false, failSummary=false
globalThis.telegramHarness.summary=async(request,locale,plain)=>{
 summaryCalls++; assert.equal(request.title,'VPN'); assert.equal(locale,'ru'); assert.equal(plain,true)
 if(failSummary) throw new Error('quota')
 return '<b>untrusted</b> VPN *not markup*'
}
currentRole='employee'
await callback('summary:'+summaryId)
assert.equal(summaryCalls,0,'Employee cannot request AI summaries')
assert(messages.at(-1).text.includes('недоступно'))
currentRole='admin'
globalThis.telegramHarness.detailOverride=()=>{if(denyDetail)throw new Error('unavailable');return {id:summaryId,number:123,title:'VPN',description:'VPN drops',status:'review'}}
globalThis.telegramHarness.aiEnabled=true
await callback('open:'+summaryId)
assert(messages.at(-1).buttons.flat().some(b=>b.callback_data==='summary:'+summaryId))
await callback('summary:'+summaryId)
assert.equal(summaryCalls,1)
assert(messages.at(-1).text.includes('<b>untrusted</b>'),'AI content stays plain text')
assert(messages.at(-1).buttons.flat().some(b=>b.callback_data==='open:'+summaryId))
failSummary=true;currentRole='handler';await callback('summary:'+summaryId)
assert(messages.at(-1).buttons.flat().some(b=>b.callback_data==='summary:'+summaryId),'AI outage offers retry')
denyDetail=true;const beforeSummary=summaryCalls;await callback('summary:'+summaryId)
assert.equal(summaryCalls,beforeSummary,'Visibility checked before sending data to AI')
await callback('summary:invalid');assert.equal(summaryCalls,beforeSummary)
console.log('PASS AI summary: admin/handler, employee/forged/denied access, plain text and retry')
