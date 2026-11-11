import assert from 'node:assert/strict'
import { createClient } from '@supabase/supabase-js'

// Run against an explicitly supplied synthetic request, never arbitrary records.
const id = process.argv[2]
assert(id, 'Supply a synthetic request UUID')
const clients = {}
for (const role of ['employee', 'handler-catalog', 'handler', 'manager-it', 'manager', 'manager-people', 'admin', 'client']) {
  const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } })
  const { error } = await client.auth.signInWithPassword({ email: role + '@kinetria.example', password: process.env.KINETRIA_DEMO_PASSWORD })
  assert.equal(error, null, 'Login ' + role)
  clients[role] = client
}
async function read(role) {
  const { data, error } = await clients[role].from('requests').select('*').eq('id', id)
  assert.equal(error, null)
  return data[0]
}
for (const role of Object.keys(clients)) {
  const row = await read(role)
  const visible = ['employee', 'handler-catalog', 'manager-it', 'admin'].includes(role)
  assert.equal(Boolean(row), visible, 'Visibility ' + role)
  const events = await clients[role].from('request_events').select('id').eq('request_id', id)
  assert.equal(events.error, null)
  assert.equal(events.data.length > 0, visible, 'History visibility ' + role)
  console.log('PASS visibility and history:', role, visible)
}
const initial = await read('employee')
assert(initial.title.startsWith('E2E '), 'Only E2E test requests may be changed')
assert.equal(initial.status, 'new', 'Supply a fresh E2E request; this check completes it')
async function action(role, changes, code) {
  const before = await read('employee')
  const { error } = await clients[role].rpc('review_request', { p_id: id, p_version: before.version, p_action: 'reviewed', p_status: null, p_message: '', p_next_step: '', p_assignee: null, ...changes })
  assert.equal(error?.code, code)
  const after = await read('employee')
  assert.equal(after.version, before.version + (code ? 0 : 1))
  console.log('PASS action:', role, changes.p_status ?? changes.p_action, code ?? 'saved')
}
await action('manager', {p_status:'review'}, 'PT404')
await action('admin', {p_status:'review'}, 'PT404')
await action('employee', {p_status:'review'}, '22023')
await action('handler-catalog', {p_status:'review'})
await action('manager-it', {p_status:'rejected'}, '22023')
await action('manager-it', {p_status:'in_progress'}, '22023')
await action('manager-it', {p_version:initial.version, p_status:'in_progress', p_next_step:'Тестовый шаг'}, 'PT409')
await action('manager-it', {p_status:'clarification', p_message:'Тест: укажите пример артикула.'})
await action('employee', {p_action:'replied', p_message:'Синтетический артикул E2E-001.'})
await action('handler-catalog', {p_status:'in_progress', p_next_step:'Подготовить тестовую таблицу соответствия.'})
await action('manager-it', {p_status:'implemented', p_message:'Тест E2E завершён: единое название и таблица соответствия проверены на синтетическом артикуле E2E-001.'})
await action('manager-it', {p_status:'review'}, '22023')
assert.equal((await read('employee')).status, 'implemented')
console.log('PASS author sees final decision')
for (const client of Object.values(clients)) await client.auth.signOut({scope:'local'})
