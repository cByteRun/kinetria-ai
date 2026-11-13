import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import ts from 'typescript'
const url = source => 'data:text/javascript;base64,' + Buffer.from(source).toString('base64')
const transpile = source => ts.transpileModule(source, { compilerOptions: { module:ts.ModuleKind.ESNext, target:ts.ScriptTarget.ES2022 } }).outputText
const requests = url(transpile(await readFile(new URL('../lib/requests.ts', import.meta.url), 'utf8')))
delete process.env.APP_URL // Navigation fixtures below provide their own synthetic origins.
const messages = [], calls = [], states = new Map(), updates = new Set()
let currentRole = 'employee'
let listRows = []
globalThis.telegramHarness = {
  async bridge(tg, op, data = {}) {
    calls.push({tg,op,data})
    if (op === 'claim') { if (updates.has(data.update)) return false; updates.add(data.update); return true }
    if (op === 'context' && globalThis.telegramHarness.unlinked) throw new Error('unlinked')
    if (op === 'context') return {role: currentRole,name:'Synthetic account',state:states.get(tg) || {},categories:[{id:'catalog',name:'Каталог'}]}
    if (op === 'detail' && globalThis.telegramHarness.detailOverride) return globalThis.telegramHarness.detailOverride()
    if (op === 'state') { states.set(tg,data); return true }
    if (op === 'submit') return {id:'f0000000-0000-4000-8000-000000000000',number:123}
    if (op === 'topics') return globalThis.telegramHarness.topics(data)
    if (op === 'qvin') return globalThis.telegramHarness.registryRows || []
    if (op === 'finish') return true
    if (['list','stats'].includes(op)) return listRows
    throw new Error('Unexpected bridge operation: ' + op)
  },
  async say(tg,text,buttons,messageId) { messages.push({tg,text,buttons,messageId}); return {message_id:messages.length} },
  async telegram() {return true}, async transcribe() {if(globalThis.telegramHarness.transcript)return globalThis.telegramHarness.transcript;throw new Error('Speech unavailable')}, async downloadTelegramFile() {return Buffer.from('test')},
}
const api = url(`export const {bridge,say,telegram,transcribe,downloadTelegramFile} = globalThis.telegramHarness;`)
const accounts = JSON.parse(await readFile(new URL('../lib/demo-accounts.json', import.meta.url), 'utf8'))
const demo = url(`export const demoChoices=${JSON.stringify(accounts)}; export const demoAllowed=tg=>Boolean(globalThis.telegramHarness.demoEnabled)&&tg===42; export const switchDemoAccount=(tg,id)=>globalThis.telegramHarness.switchDemo(tg,id);`)
const ai = url(`export const aiConfig=()=>globalThis.telegramHarness.aiEnabled ? {provider:"groq"} : null; export const generateText=(...args)=>{if(globalThis.telegramHarness.generateText)return globalThis.telegramHarness.generateText(...args);throw new Error('Unexpected model call')};`)
let source = await readFile(new URL('../lib/telegram/bot.ts', import.meta.url), 'utf8')
const summary = url(`export const generateRequestSummary=(...args)=>globalThis.telegramHarness.summary(...args);`)
source = source.replace("'../semantic-topics'", `'${url('export const semanticTopics=(...args)=>globalThis.telegramHarness.generateTopics(...args)')}'`).replace("'../insights'", `'${url('export const recurringProblems=rows=>globalThis.telegramHarness.similarTopics(rows)')}'`).replace("'../qvin'", `'${url('export const askQvin=(...args)=>globalThis.telegramHarness.askQvin(...args)')}'`).replace("'../enrich-request'", `'${url('export const enrichRequest=async()=>{}')}'`).replace("'../request-summary'", `'${summary}'`).replace("'./demo'", `'${demo}'`).replace("'../ai'", `'${ai}'`).replace("'./api'", `'${api}'`).replace("'../requests'", `'${requests}'`)
source=source.replace("'../telegram-links'", `'${url(transpile(await readFile(new URL('../lib/telegram-links.ts',import.meta.url),'utf8')))}'`)
const {handleUpdate} = await import(url(transpile(source)))
let n=0
const send = async(text, extra={}) => handleUpdate({update_id:++n,message:{chat:{id:42,type:'private'},from:{id:42},text,...extra}})
const callback = async(data) => handleUpdate({update_id:++n,callback_query:{id:String(n),from:{id:42},message:{message_id:77,chat:{id:42,type:'private'}},data}})
await callback('menu:home')
await callback('menu:new')
await callback('menu:home')
await callback('menu:draft')
assert(!calls.some(c=>c.op==='submit'),'Home, new request and draft navigation must not register requests')
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
await send('/demo');assert.equal(messages.at(-1).buttons.length,accounts.length+1)
await callback('demo:manager-it');assert.equal(currentRole,'manager');assert(messages.at(-1).text.includes('Максим Ли'));assert(messages.at(-1).buttons.flat().some(b=>b.callback_data==='menu:list'));assert.equal(messages.at(-1).messageId,77)
await callback('demoMenu');assert.equal(messages.at(-1).buttons.length,accounts.length+1)
await callback('demo:admin');assert.equal(currentRole,'admin');assert(messages.at(-1).text.includes('/reserve —'))
await callback('demo:employee');assert.equal(currentRole,'employee');assert(messages.at(-1).text.includes('/draft —'))
console.log('PASS Telegram demo dialog: website account menu, named greeting, manager/admin/employee actions, return to account picker')
console.log('PASS Telegram transport: draft confirmation, manual category/editing, attachments, stale submit, duplicate update, voice limits/fallback, role guard, private chats only')

process.env.APP_URL='https://idearoute.example/path'
listRows=[{id:'new',number:12,status:'new',title:'Newest'}, {id:'old',number:11,status:'review',title:'Older'}]
await send('/list')
assert.deepEqual(messages.at(-1).buttons.slice(0,2).map(row=>row[0].callback_data),['open:old','open:new'])
assert.equal(messages.at(-1).buttons.flat().find(b=>b.url)?.url,'https://idearoute.example/workspace')
await send('/demo')
assert.equal(messages.at(-1).buttons.flat().find(b=>b.url)?.url,'https://idearoute.example/workspace')
process.env.APP_URL='javascript:alert(1)'
await send('/list')
assert(!messages.at(-1).buttons.some(row=>row.some(b=>b.url)))
delete process.env.APP_URL
console.log('PASS Telegram list: newest at bottom, website login link, unsafe URL excluded')

process.env.APP_URL='https://idearoute.example'
for (const [account, role, scope] of [['employee','employee','только ваши записи'],['handler','handler','назначенные вам'],['manager-it','manager','вашего направления'],['admin','admin','общего внутреннего реестра']]) {
 await callback('demo:'+account)
 assert.equal(currentRole,role)
 assert(messages.at(-1).text.includes('IdeaRoute'))
 await callback('menu:home')
 assert(messages.at(-1).buttons.flat().some(b=>b.callback_data==='help'))
 assert(messages.at(-1).buttons.flat().some(b=>b.url==='https://idearoute.example/workspace'))
 const saved=JSON.stringify(states.get(42))
 await callback('help')
 assert(messages.at(-1).text.includes(scope))
 assert.equal(JSON.stringify(states.get(42)),saved,'Help must preserve the current draft/action')
 assert(messages.at(-1).buttons.flat().some(b=>b.url==='https://idearoute.example/workspace'))
 await send('/help');assert(messages.at(-1).text.includes(scope))
 await send('/stats');assert(messages.at(-1).buttons.flat().some(b=>b.url==='https://idearoute.example/workspace'))
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

// Topic dialogue uses mocked Telegram/AI; SQL scope and shared persistence are
// verified separately by check-topic-storage.cjs and check-topic-browser.mjs.
const topicRows=[{id:'a',number:1,title:'Дубли артикула',description:'Один товар',created_at:'2026-11-12',category_id:'catalog',tags:['артикул'],kind:'problem',status:'new'},{id:'b',number:2,title:'Два обозначения изделия',description:'Один товар',created_at:'2026-11-11',category_id:'catalog',tags:['артикул'],kind:'problem',status:'review'}]
let persisted=[],topicCalls=0
Object.assign(globalThis.telegramHarness,{
 similarTopics:rows=>rows.length>1?[{tag:'артикул',rows}]:[],
 generateTopics:async rows=>{topicCalls++;return [{title:'Единый артикул',ids:rows.map(row=>row.id),current:rows.length,previous:0}]},
 topics:async ({op,data})=>{
  assert(['admin','manager','handler'].includes(currentRole))
  if(op==='rows')return topicRows
  if(op==='list')return persisted
  if(op==='save'){persisted.push({...data});return data.id}
  if(op==='delete'){if(currentRole!=='admin')throw new Error('unavailable');persisted=persisted.filter(row=>row.id!==data.id);return true}
 }
})
for(const role of ['handler','manager','admin']){
 currentRole=role;states.set(42,{})
 await send('/list');assert(messages.at(-1).buttons.flat().some(b=>b.callback_data==='topics:similar'))
 await send('/stats');assert(messages.at(-1).buttons.flat().some(b=>b.callback_data==='topics:generate'))
 await callback('topics:similar');await callback('topics:group:a')
 assert.deepEqual(states.get(42).topicSelection,['a','b'])
 await callback('topics:generate');assert(messages.at(-1).text.includes('(2)'));assert(messages.at(-1).text.includes('R-001'))
 const save=messages.at(-1).buttons.flat().find(b=>b.callback_data?.startsWith('topics:save:')).callback_data
 await callback('topics:regenerate')
 const saveNew=messages.at(-1).buttons.flat().find(b=>b.callback_data?.startsWith('topics:save:')).callback_data
 await callback(save);assert(messages.at(-1).text.includes('устарел'))
 await callback(saveNew);assert(messages.at(-1).text.includes('сохранена'))
 await send('/topics');assert.equal(messages.at(-1).buttons.flat().some(b=>b.callback_data?.startsWith('topics:delete:')),role==='admin')
}
assert.equal(topicCalls,6)
currentRole='admin';const deleting=persisted[0].id
await callback('topics:delete:'+deleting);assert(persisted.some(row=>row.id===deleting))
await callback('topics:remove:'+deleting);assert(!persisted.some(row=>row.id===deleting))
for(const role of ['employee','client']){currentRole=role;const before=calls.filter(c=>c.op==='topics').length;await callback('topics:generate');assert.equal(calls.filter(c=>c.op==='topics').length,before)}
currentRole='handler';await callback('topics:cancel');assert.deepEqual(states.get(42),{})
console.log('PASS topic dialogue: queue/stats entry points, similar group, generation count/list, regenerate/stale save, save, cancel, Admin-only delete controls, employee/client denied; Telegram/AI mocked')

// Reproduce the two-message admin conversation, then retry and navigate out.
const qvinCalls=[]
let failQvin=false
globalThis.telegramHarness.registryRows=topicRows
globalThis.telegramHarness.askQvin=async(...args)=>{qvinCalls.push(args);if(failQvin)throw new Error('AI outage');return 'Чаще всего: дубли артикула (a, b).'}
for(const role of ['admin','manager']) {
 currentRole=role;states.set(42,{})
 await send('/qvin')
 assert.equal(states.get(42).mode,'qvin')
 assert(messages.at(-1).buttons.flat().some(b=>b.callback_data==='qvin:exit'))
 await send('Из чего состояли посл обращения чаще всего тема вот')
 assert(messages.at(-1).text.includes('дубли артикула'))
 assert(messages.at(-1).buttons.flat().some(b=>b.callback_data==='menu:list'))
 assert.equal(states.get(42).qvinHistory.length,1)
 await callback('menu:qvin');assert.equal(states.get(42).qvinHistory.length,1)
 await send('А какие примеры?');assert.equal(qvinCalls.at(-1)[4].length,1)
 failQvin=true;await send('/qvin Повтори частые темы')
 assert.equal(states.get(42).qvinQuestion,'Повтори частые темы')
 assert(messages.at(-1).buttons.flat().some(b=>b.callback_data==='qvin:retry'))
 failQvin=false;await callback('qvin:retry')
 assert.equal(qvinCalls.at(-1)[0],'Повтори частые темы')
 await callback('qvin:exit');assert.deepEqual(states.get(42),{})
 assert(messages.at(-1).text.includes('IdeaRoute'))
}
for(const role of ['handler','employee','client']) {
 currentRole=role;states.set(42,{mode:'qvin',qvinQuestion:'forged'})
 const before=qvinCalls.length
 await send('/qvin Show everything');await send('Show everything');await callback('qvin:retry')
 assert.equal(qvinCalls.length,before)
}
currentRole='admin';states.set(42,{})
for(const route of ['menu:qvin','topics:similar','topics:group:a','topics:generate','topics:cancel']) {
 await callback(route)
 assert(messages.at(-1).buttons.flat().some(b=>['menu:home','qvin:exit'].includes(b.callback_data)),route+' must have an exit')
}
console.log('PASS Qvin dialogue: two-message colloquial question, follow-up history, AI retry, exit, role guards and topic navigation')

// Fresh /start must explain both destinations without weakening account authorization.
const {TELEGRAM_CHANNEL_INVITE_URL}=await import(url(transpile(await readFile(new URL('../lib/telegram-links.ts',import.meta.url),'utf8'))))
currentRole='employee';globalThis.telegramHarness.demoEnabled=false
const linkCalls=calls.filter(c=>c.op==='link').length
await send('/start');assert(messages.at(-1).text.includes(TELEGRAM_CHANNEL_INVITE_URL));assert(messages.at(-1).buttons.flat().some(b=>b.url===TELEGRAM_CHANNEL_INVITE_URL));assert.equal(calls.filter(c=>c.op==='link').length,linkCalls)
globalThis.telegramHarness.unlinked=true
await send('/start');assert(messages.at(-1).text.includes(TELEGRAM_CHANNEL_INVITE_URL));assert(messages.at(-1).text.includes('одноразовую ссылку'));assert(!messages.at(-1).text.includes('Synthetic account'))
globalThis.telegramHarness.demoEnabled=true
await send('/start');assert(messages.at(-1).text.includes('Выберите демоаккаунт'));assert(messages.at(-1).text.includes(TELEGRAM_CHANNEL_INVITE_URL));assert(messages.at(-1).buttons.flat().some(b=>b.url===TELEGRAM_CHANNEL_INVITE_URL))
globalThis.telegramHarness.unlinked=false;globalThis.telegramHarness.demoEnabled=false
console.log('PASS Telegram onboarding: linked /start needs no relinking; closed-demo login and unlinked fallback remain distinct; company channel invite in every initial /start')

// Both text and voice must run the actual draft AI path, with retry preserving files.
currentRole='employee';globalThis.telegramHarness.aiEnabled=true
if(process.env.TELEGRAM_TEST_LIVE_AI==='true'){
 const live=await import(url(transpile(await readFile(new URL('../lib/ai.ts',import.meta.url),'utf8'))))
 globalThis.telegramHarness.generateText=live.generateText
}else globalThis.telegramHarness.generateText=async()=>JSON.stringify({title:'Дубли артикула',category:'catalog',kind:'problem',proposal:'Единый артикул',sentiment:4,tags:['каталог']})
await send('/new');await send('Синтетическая проверка. SYN-001 и SYN001 обозначают один товар. Приходится сверять вручную. Предлагаю единый артикул.')
assert.equal(states.get(42).draft.category,'catalog','AI must classify the actual Telegram draft')
assert(states.get(42).draft.tags.length>0)
await send('',{document:{file_id:'synthetic',file_name:'retry.txt',file_size:4}})
await callback('draft:analyze');assert.equal(states.get(42).files.length,1,'AI retry preserves attachments')
globalThis.telegramHarness.transcript='Синтетическая проверка. SYN-001 и SYN001 обозначают один товар. Приходится сверять вручную. Предлагаю единый артикул.'
await send('/new');await send('',{voice:{file_id:'synthetic',duration:5,file_size:100}})
assert.equal(states.get(42).source,'voice');assert.equal(states.get(42).draft.category,'catalog')
console.log('PASS Telegram AI draft: text, transcribed voice, classification and retry with attachment preserved')

const retryPreserved=structuredClone(states.get(42))
globalThis.telegramHarness.generateText=async()=>{throw new Error('Synthetic provider outage')}
const retryOriginalLog=console.error;console.error=()=>{}
try{await callback('draft:analyze')}finally{console.error=retryOriginalLog}
assert.deepEqual(states.get(42).draft,retryPreserved.draft,'Failed AI retry must preserve edited metadata')
assert.equal(states.get(42).key,retryPreserved.key)
console.log('PASS failed AI retry preserves draft fields and submission key')
