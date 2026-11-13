// Real webhook -> bot -> API bridge -> local PostgreSQL domain functions.
// All database changes run in one transaction and are rolled back on exit.
// Telegram/Groq are stubbed: this never sends a real message or calls AI.
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { spawn } from 'node:child_process'
import { createInterface } from 'node:readline'
import ts from 'typescript'

const db = spawn('docker', ['exec', '-i', process.env.TELEGRAM_TEST_DB || 'supabase_db_modus_IDEA', 'psql', '-XqAt', '-v', 'ON_ERROR_STOP=1', '-U', 'postgres', '-d', 'postgres'], { stdio: ['pipe', 'pipe', 'pipe'] })
const waiting = []
let dbFailure
createInterface({ input: db.stdout }).on('line', line => {
  if (line.startsWith('{') || line.startsWith('[')) waiting.shift()?.resolve(JSON.parse(line))
})
db.stderr.on('data', () => { dbFailure = new Error('Local PostgreSQL test failed; check migrations and demo seed') })
db.on('error', error => { dbFailure = error; while (waiting.length) waiting.shift().reject(error) })
db.on('exit', () => { while (waiting.length) waiting.shift().reject(dbFailure || new Error('Local PostgreSQL disconnected')) })
const literal = value => "'" + String(value).replaceAll("'", "''") + "'"
const sql = query => new Promise((resolve, reject) => { waiting.push({ resolve, reject }); db.stdin.write(query + ';\n') })
const toUrl = value => 'data:text/javascript;base64,' + Buffer.from(value).toString('base64')
const compile = source => toUrl(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText)
const source = path => readFile(new URL('../' + path, import.meta.url), 'utf8')
const messages = [], operations = [], afterTasks = [], documents = []
let failSend = false, temporaryDbFailure = false, updateId = 980000000
try {
  db.stdin.write(`begin;
    set client_min_messages=error;
    create function pg_temp.test_bridge(tg bigint, op text, payload jsonb) returns jsonb language plpgsql as $$
    begin return jsonb_build_object('data',public.telegram_bridge(tg,op,payload));
    exception when others then return jsonb_build_object('error',jsonb_build_object('code',SQLSTATE)); end; $$;
  `)
  db.stdin.write((await source('supabase/migrations/20261112181447_telegram_async_inbox.sql'))+'\n');
  const people = await sql(`select jsonb_object_agg(role,id) from (
    select distinct on(p.role) p.role,p.id from public.profiles p where p.active and p.role in('employee','manager','handler','admin','client')
    and (p.role<>'manager' or exists(select 1 from kinetria_private.manager_categories m where m.manager_id=p.id and m.category_id='catalog')) order by p.role,p.id) x`)
  assert.equal(Object.keys(people).length, 5, 'Seed all four roles and a catalog manager first')
  const ids = { employee: 980001, manager: 980002, handler: 980003, admin: 980004, client:980005 }
  await sql(`with removed as (delete from public.telegram_links where user_id in(${Object.values(people).map(literal).join(',')}) or telegram_id between 980001 and 980005),
    sessions as (delete from public.telegram_sessions where telegram_id between 980001 and 980005),
    updates as (delete from public.telegram_updates where id between 980000000 and 980001000)
    select '{}'::jsonb`)
  for (const role of Object.keys(ids)) await sql(`with added as (insert into public.telegram_links values(${ids[role]},${literal(people[role])})) select '{}'::jsonb`)
  await sql(`with routed as (update kinetria_private.category_routes set assignee_id=${literal(people.manager)},enabled=true where category_id='catalog') select '{}'::jsonb`)
  class Query {
    constructor(table) { assert(['profiles', 'request_events'].includes(table)); this.table = table; this.filters = []; this.columns = '*'; this.cap = 100; this.one = false }
    select(columns) { assert(/^[a-z_,]+$/.test(columns)); this.columns = columns; return this }
    eq(key, value) { assert(/^[a-z_]+$/.test(key)); this.filters.push(key + '=' + literal(value)); return this }
    order(key) { assert.equal(key, 'id'); this.sort = 'order by id desc'; return this }
    limit(value) { this.cap = value; return this }
    range(start, end) { this.offset = start; this.cap = end - start + 1; return this }
    maybeSingle() { this.one = true; return this }
    async then(resolve, reject) {
      try {
        const rows = await sql(`select coalesce(jsonb_agg(x),'[]') from(select ${this.columns} from public.${this.table} where ${this.filters.join(' and ')} ${this.sort || ''} limit ${this.cap} offset ${this.offset || 0}) x`)
        return resolve({ data: this.one ? rows[0] || null : rows, error: null })
      } catch (error) { return reject(error) }
    }
  }
  globalThis.webhookWorkflow = {
    createClient: () => ({
      from: table => new Query(table),
      async rpc(name, { p_tg, p_op, p_data }) {
        if (name !== 'telegram_bridge') {
          const args = arguments[1];
          const specs = {telegram_enqueue:['p_id','p_tg','p_payload'],telegram_inbox_claim:['p_limit'],telegram_inbox_finish:['p_id','p_token','p_success']};
          const params=specs[name].map(k=>k==='p_payload'?literal(JSON.stringify(args[k]))+'::jsonb':literal(args[k])).join(',');
          return sql(`select jsonb_build_object('data',public.${name}(${params}))`);
        }
        operations.push({ tg: p_tg, op: p_op, data: p_data })
        if (temporaryDbFailure && p_op === 'context') { temporaryDbFailure = false; return { data: null, error: { code: '', message: 'sensitive provider data' } } }
        return sql(`select pg_temp.test_bridge(${p_tg},${literal(p_op)},${literal(JSON.stringify(p_data))}::jsonb)`)
      },
    }),
    async say(tg, text, buttons = []) { if (failSend) { failSend = false; throw new Error('fetch failed') } messages.push({ tg, text, buttons }); return { message_id: messages.length } },
    async telegram(method, body) { if (method === 'sendDocument') documents.push({tg:Number(body.get('chat_id')), name:body.get('document').name, content:await body.get('document').text()}); return true },
    async transcribe() { return 'В каталоге SYN-001 и SYN001 обозначают один товар. Согласовать единый артикул.' },
    async downloadTelegramFile() { return Buffer.from('test') },
    after: task => afterTasks.push(task),
    deliverOutbox: async () => globalThis.demoDelivery ? globalThis.demoDelivery() : ({ sent: 0 }),
  }
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://synthetic.example'
  process.env.SUPABASE_SECRET_KEY = 'synthetic'
  process.env.TELEGRAM_WEBHOOK_SECRET = 'synthetic-test-secret'
  const apiSource = (await source('lib/telegram/api.ts')).replace("'../speech'", `'${compile(await source('lib/speech.ts'))}'`).replace("'./rate-limit'", `'${toUrl('export const apiSlot=async()=>0;export const waitForApiSlot=async()=>{}')}'`).replace("'@supabase/supabase-js'", `'${toUrl('export const {createClient}=globalThis.webhookWorkflow')}'`)
  const api = await import(compile(apiSource))
  globalThis.webhookWorkflow.bridge = api.bridge
  globalThis.webhookWorkflow.secretMatches = api.secretMatches
  globalThis.webhookWorkflow.telegramDb = api.telegramDb
  const apiUrl = toUrl('export const {bridge,say,telegram,transcribe,downloadTelegramFile,secretMatches,telegramDb}=globalThis.webhookWorkflow')
  const requestsUrl = compile(await source('lib/requests.ts'))
  const botUrl = compile((await source('lib/telegram/bot.ts'))
    .replace("'../semantic-topics'", `'${toUrl('export const semanticTopics=async()=>[]')}'`).replace("'../insights'", `'${toUrl('export const recurringProblems=()=>[]')}'`)
    .replace("'../qvin'", `'${toUrl('export const askQvin=async(q,rows)=>"QVIN_ROWS:"+rows.map(r=>r.id).join(",")')}'`)
    .replace("'../enrich-request'", `'${toUrl('export const enrichRequest=async()=>{}')}'`)
    .replace("'../request-summary'", `'${toUrl('export const generateRequestSummary=()=>{throw new Error("Unexpected summary call")}')}'`)
    .replace("'./api'", `'${apiUrl}'`).replace("'../requests'", `'${requestsUrl}'`)
    .replace("'./demo'", `'${toUrl('export const demoAllowed=()=>false;export const demoChoices=[];export const switchDemoAccount=()=>{throw new Error("Unexpected demo switch")}')}'`)
    .replace("'../ai'", `'${toUrl('export const aiConfig=()=>null;export const generateText=()=>{throw new Error("Unexpected AI call")}')}'`))
  const inboxUrl = compile((await source('lib/telegram/inbox.ts')).replace("'./api'",`'${apiUrl}'`).replace("'./bot'",`'${botUrl}'`));
  const inbox = await import(inboxUrl);
  const route = await import(compile((await source('app/api/telegram/webhook/route.ts'))
    .replace("'next/server'", `'${toUrl('export const {after}=globalThis.webhookWorkflow')}'`)
    .replace("'../../../../lib/telegram/api'", `'${apiUrl}'`)
    .replace("'../../../../lib/telegram/inbox'", `'${inboxUrl}'`)
    .replace("'../../../../lib/telegram/delivery'", `'${toUrl('export const {deliverOutbox}=globalThis.webhookWorkflow')}'`)))
  const post = async update => {const response = await route.POST(new Request('https://app.example/api/telegram/webhook', { method: 'POST', headers: { 'x-telegram-bot-api-secret-token': process.env.TELEGRAM_WEBHOOK_SECRET }, body: JSON.stringify(update) }));await Promise.all(afterTasks.splice(0).map(task=>task()));return response}
  const send = async (role, text, extra = {}) => { const tg = ids[role]; const update = { update_id: ++updateId, message: { chat: { id: tg, type: 'private' }, from: { id: tg }, text, ...extra } }; assert.equal((await post(update)).status, 200); return update }
  const click = async (role, data) => { const tg = ids[role]; const update = { update_id: ++updateId, callback_query: { id: String(updateId), from: { id: tg }, message: { chat: { id: tg, type: 'private' } }, data } }; assert.equal((await post(update)).status, 200); return update }
  const context = role => api.bridge(ids[role], 'context')
  const open = (role, id) => click(role, 'open:' + id)
  const button = prefix => messages.at(-1).buttons.flat().find(b => b.callback_data?.startsWith(prefix))?.callback_data
  const detail = (role, id) => api.bridge(ids[role], 'detail', { id })

  if (process.env.DEMO_TELEGRAM_SERVER === 'true') {
    await (await import('./demo-telegram-server.mjs')).start({send,click,messages,ids,detail,context,sql,source,compile,toUrl,api,people});
  } else {
  await send('employee', '/new')
  await send('employee', '', { voice: { file_id: 'synthetic-voice', duration: 15 } })
  let state = (await context('employee')).state
  assert.equal(state.source, 'voice'); assert(!operations.some(x => x.op === 'submit'))
  await click('employee', 'cat:' + (await context('employee')).categories.findIndex(x => x.id === 'catalog'))
  await click('employee', 'attach')
  await send('employee', '', { document: { file_id: 'synthetic-file', file_name: 'test.txt', file_size: 4 } })
  state = (await context('employee')).state
  const submitted = await click('employee', 'submit:' + state.key)
  const record = (await api.bridge(ids.employee, 'list'))[0]
  const id = record.id
  assert.equal((await detail('employee', id)).files.length, 1)
  const fileId = (await detail('employee', id)).files[0].id
  for (const role of ['employee', 'manager', 'admin']) {
    await open(role, id); await click(role, 'file:' + fileId)
    assert.deepEqual(documents.at(-1), {tg:ids[role], name:'test.txt', content:'test'})
  }
  await assert.rejects(() => api.bridge(ids.handler, 'file', {id, file:fileId}), /unavailable/)

  const beforeReplay = messages.length
  assert.equal((await post(submitted)).status, 200); assert.equal(messages.length, beforeReplay)
  await open('manager', id); await click('manager', 'assign:' + id)
  const person = button('person:'); assert(person)
  // Select the known handler, preserving the assignment dialog nonce.
  await click('manager', 'person:' + person.split(':')[1] + ':' + people.handler)
  await send('manager', '2026-12-01')
  const firstConfirm = button('confirmAssign:'); assert(firstConfirm)
  await click('manager', firstConfirm)
  assert.equal((await detail('handler', id)).due_at, '2026-12-01')
  await open('handler', id); await click('handler', 'file:' + fileId)
  assert.deepEqual(documents.at(-1), {tg:ids.handler, name:'test.txt', content:'test'})
  await click('handler', 'review:review:' + id)
  await click('handler', 'review:clarification:' + id)
  const question = ('Уточните, где встречаются артикулы SYN-001/SYN001. ' + 'Нужен контекст закупки. '.repeat(30)).trim()
  await send('handler', question)
  // More than eight comments must not hide the pending question.
  for (let i = 0; i < 9; i++) {
    const r = await detail('employee', id)
    await api.bridge(ids.employee, 'comment', { id, version: r.version, message: 'Синтетический комментарий ' + i })
  }
  await open('employee', id)
  assert(messages.at(-1).text.includes(question), 'Show the full question even outside the last eight events')
  await click('employee', 'history:' + id)
  assert(button('history:' + id + ':8'), 'History must offer earlier events')
  await click('employee', 'history:' + id + ':8')
  assert(messages.at(-1).text.includes(question), 'History must not truncate the clarification')
  await open('employee', id)
  await click('employee', 'reply:' + id); await send('employee', 'Оба артикула встречаются в спецификации закупки SYN.')
  assert.equal((await detail('manager', id)).status, 'review')
  await open('handler', id); await click('handler', 'review:in_progress:' + id); await send('handler', 'Согласовать основной код SYN-001 с закупками.')
  await click('handler', 'review:implemented:' + id); await send('handler', 'В каталоге закреплён SYN-001; SYN001 сохранён как поисковый алиас.')
  await open('employee', id); assert(messages.at(-1).text.includes('поисковый алиас'))
  await click('employee', 'ack:' + id); assert((await detail('employee', id)).acknowledged_at)
  await open('admin', id); assert(!button('review:'), 'Admin must not decide cases')
  await click('admin', 'review:implemented:' + id); assert(messages.at(-1).text.includes('недоступно'))

  // Reserve scenario: no route -> admin assigns manager -> scoped manager sees it.
  await sql(`with disabled as (update kinetria_private.category_routes set enabled=false where category_id='catalog') select '{}'::jsonb`)
  await send('employee', '/new'); await send('employee', 'Синтетическая проблема для резервной очереди.')
  await click('employee', 'cat:' + (await context('employee')).categories.findIndex(x => x.id === 'catalog'))
  await click('employee', 'submit:' + (await context('employee')).state.key)
  const reserve = (await api.bridge(ids.employee, 'list'))[0]
  assert.equal(reserve.assignee_id, null)
  await send('admin', '/reserve'); assert(button('open:' + reserve.id))
  await open('admin', reserve.id); await click('admin', 'assign:' + reserve.id)
  const nonce = button('person:').split(':')[1]
  await click('admin', 'person:' + nonce + ':' + people.manager); await send('admin', '-')
  const confirm = button('confirmAssign:')
  await click('admin', firstConfirm)
  assert.equal((await detail('admin', reserve.id)).assignee_id, null, 'Old confirmation cannot confirm a different dialog')
  await click('admin', confirm); assert.equal((await detail('manager', reserve.id)).assignee_id, people.manager)
  await assert.rejects(() => detail('handler', reserve.id), /unavailable/)
  await open('manager', reserve.id)
  const r = await detail('manager', reserve.id)
  await api.bridge(ids.admin, 'comment', { id: reserve.id, version: r.version, message: 'Версия изменена в вебе' })
  await click('manager', 'review:review:' + reserve.id)
  assert.equal((await detail('manager', reserve.id)).status, 'new', 'Stale card must not change status')

  // Retry must remain possible when the actual API adapter sees a network error.
  temporaryDbFailure = true
  const retry = { update_id: ++updateId, message: { chat: { id: ids.employee, type: 'private' }, from: { id: ids.employee }, text: '/list' } }
  const originalError = console.error; console.error = () => {}
  try { assert.equal((await post(retry)).status, 200) } finally { console.error = originalError }
  await sql(`with expired as(update public.telegram_updates set leased_until=now()-interval '1 microsecond' where id=${updateId}),ready as(update public.telegram_inbox set available_at=now()-interval '1 second' where id=${updateId}) select '{}'::jsonb`)
  assert.equal((await post(retry)).status, 200)
  // A reply delivery failure after submit must not create a second request.
  await send('employee', '/new'); await send('employee', 'Повтор webhook после регистрации не создаёт дубль.')
  await click('employee', 'cat:' + (await context('employee')).categories.findIndex(x => x.id === 'catalog'))
  const key = (await context('employee')).state.key
  const retrySubmit = { update_id: ++updateId, callback_query: { id: String(updateId), from: { id: ids.employee }, message: { chat: { id: ids.employee, type: 'private' } }, data: 'submit:' + key } }
  failSend = true; console.error = () => {}
  try { assert.equal((await post(retrySubmit)).status, 200) } finally { console.error = originalError }
  await sql(`with expired as(update public.telegram_updates set leased_until=now()-interval '1 microsecond' where id=${updateId}),ready as(update public.telegram_inbox set available_at=now()-interval '1 second' where id=${updateId}) select '{}'::jsonb`)
  assert.equal((await post(retrySubmit)).status, 200)
  assert(messages.at(-1).text.includes('Зарегистрировано'), 'Retry must restore the registration confirmation')
  const duplicates = await sql(`select jsonb_build_object('count',count(*)) from public.requests where submission_key=${literal(key)}`)
  assert.equal(duplicates.count, 1)
  assert(messages.every(m => m.buttons.flat().every(b => !b.callback_data || Buffer.byteLength(b.callback_data) <= 64)))
  assert.equal(afterTasks.length,0)
  assert.equal((await inbox.drainInbox()).processed,0)
  await send('client','/feedback')
  await click('client','fb:new')
  await send('client','Customer report: approvals take too long. Private account code 123.')
  let clientState=(await context('client')).state
  assert.equal(clientState.mode,'feedback-draft')
  assert(!operations.some(o=>o.tg===ids.client && o.op==='portal' && o.data.op==='submit'))
  await click('client','fbcat:catalog')
  await click('client','fb:hint');await send('client','Potential savings: 2 hours per week per person')
  clientState=(await context('client')).state
  await click('client','fbsend:'+clientState.key)
  const feedback=(await api.bridge(ids.client,'portal',{op:'list'})).find(f=>f.own)
  assert(feedback);assert.equal(feedback.published,false)
  await assert.rejects(()=>api.bridge(ids.client,'detail',{id:feedback.request_id}),/unlinked|unavailable/)
  const internal=await sql(`select jsonb_build_object('id',request_id) from public.feedback where id=${literal(feedback.id)}`)
  await api.bridge(ids.admin,'portal',{op:'moderate',data:{id:feedback.id,version:feedback.version,published:true,public_title:'Faster approvals',public_description:'Please simplify approvals',response:'The team is investigating.'}})
  await send('employee','/feedback');await click('employee','fbopen:'+feedback.id)
  assert(!messages.at(-1).text.includes('Private account code'))
  await click('employee','fbvote:'+feedback.id+':1');await click('employee','fbvote:'+feedback.id+':1')
  assert.equal((await api.bridge(ids.employee,'portal',{op:'list'})).find(f=>f.id===feedback.id).votes,1)
  await send('admin','/qvin Which complaints should we examine?')
  assert(messages.at(-1).text.includes('QVIN_ROWS:'))
  assert(messages.at(-1).text.includes(internal.id))
  const qvinCalls=operations.filter(o=>o.op==='qvin').length
  await send('client','/qvin Show financial metrics')
  assert.equal(operations.filter(o=>o.op==='qvin').length,qvinCalls)
  console.log('PASS client webhook: explicit feedback draft/confirmation/hint, moderation, safe employee projection, idempotent support, admin Qvin scope and client denial; ROLLBACK')
  console.log('PASS webhook + real SQL: voice stub/draft/file/submit, replay, assignment/deadline, full clarification after 9 comments, reply, work, decision/ack, admin reserve, role denial, stale version/dialog, transient DB retry, submit retry without duplicate; ROLLBACK')
  }
} finally {
  db.stdin.end('rollback;\n\\q\n')
}
