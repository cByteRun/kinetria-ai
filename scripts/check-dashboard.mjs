import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
const url = process.env.NEXT_PUBLIC_SUPABASE_URL,
  key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
assert(
  url && key && process.env.KINETRIA_DEMO_PASSWORD,
  'Load .env.local before running',
)
const clients = {}
for (const role of ['employee', 'manager', 'manager-it', 'admin', 'client']) {
  const c = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { error } = await c.auth.signInWithPassword({
    email: role + '@kinetria.example',
    password: process.env.KINETRIA_DEMO_PASSWORD,
  })
  assert.equal(error, null, 'Login ' + role)
  clients[role] = c
}
async function rpc(role, name, args) {
  const r = await clients[role].rpc(name, args)
  assert.equal(r.error, null, name + ' ' + r.error?.message)
  return r.data
}
async function row(role, id) {
  const r = await clients[role]
    .from('requests')
    .select('*')
    .eq('id', id)
    .maybeSingle()
  assert.equal(r.error, null)
  return r.data
}
const category = 'e2e-' + randomUUID()
await rpc('admin', 'save_category', {
  p_id: category,
  p_name: 'Демо · проверка маршрута',
  p_active: true,
  p_department: 'E2E',
  p_days: 2,
})
const {
  data: { user: manager },
} = await clients['manager-it'].auth.getUser()
await rpc('admin', 'save_routing', {
  p_category: category,
  p_manager: manager.id,
})
const args = {
  p_key: randomUUID(),
  p_category: category,
  p_kind: 'praise',
  p_title: 'E2E dashboard · ' + category,
  p_description: 'Синтетическая проверка маршрута и прав.',
  p_proposal: '',
  p_sentiment: 8,
  p_tags: [],
  p_files: [
    {
      name: 'e2e.txt',
      size: 4,
      content: Buffer.from('test').toString('base64'),
    },
  ],
}
const id = await rpc('employee', 'submit_with_files', args)
assert.equal(
  await rpc('employee', 'submit_with_files', args),
  id,
  'Idempotent submit',
)
let r = await row('employee', id)
assert(r.due_at)
assert.equal(r.department, 'E2E')
assert.equal(r.assignee_id, manager.id)
assert.equal(await row('manager', id), null, 'Unrelated manager denied')
assert.equal(await row('client', id), null, 'Client denied')
assert.equal(
  (await rpc('manager', 'request_people', { p_id: id })).length,
  0,
  'Unrelated manager cannot read participants',
)
assert.equal(
  (await rpc('employee', 'request_people', { p_id: id })).length,
  1,
  'Author sees participants',
)
const file = await clients.employee
  .from('request_attachments')
  .select('id,name,content')
  .eq('request_id', id)
assert.equal(file.data.length, 1)
const denied = await clients.manager
  .from('request_attachments')
  .select('id')
  .eq('request_id', id)
assert.equal(denied.data.length, 0, 'Files follow RLS')
const anon = createClient(url, key, { auth: { persistSession: false } })
assert((await anon.from('requests').select('id')).error, 'Anonymous denied')
async function review(status, message = '', next = '') {
  const current = await row('employee', id)
  await rpc('manager-it', 'review_request', {
    p_id: id,
    p_version: current.version,
    p_action: 'reviewed',
    p_status: status,
    p_message: message,
    p_next_step: next,
    p_assignee: null,
  })
}
await review('review')
assert((await row('employee', id)).first_response_at)
await review('clarification', 'Уточните пример.')
r = await row('employee', id)
await rpc('employee', 'review_request', {
  p_id: id,
  p_version: r.version,
  p_action: 'replied',
  p_status: null,
  p_message: 'Пример E2E-001.',
  p_next_step: '',
  p_assignee: null,
})
r = await row('employee', id)
const action = {
  p_id: id,
  p_version: r.version,
  p_action: 'metadata',
  p_message: '',
  p_priority: 'high',
  p_due: '2026-11-20',
  p_assignee: null,
}
assert(
  (await clients.employee.rpc('dashboard_action', action)).error,
  'Author cannot change metadata',
)
await rpc('manager-it', 'dashboard_action', action)
assert(
  (await clients['manager-it'].rpc('dashboard_action', action)).error?.code ===
    'PT409',
  'Stale version rejected',
)
r = await row('employee', id)
await rpc('employee', 'dashboard_action', {
  p_id: id,
  p_version: r.version,
  p_action: 'commented',
  p_message: 'Материал проверен.',
})
await review('in_progress', '', 'Выполнить проверку на синтетических данных.')
await review(
  'implemented',
  'Проверка выполнена, результат доступен автору.',
  'Синтетический сценарий завершён.',
)
r = await row('employee', id)
assert(r.resolved_at)
assert.equal(r.priority, 'high')
await rpc('employee', 'dashboard_action', {
  p_id: id,
  p_version: r.version,
  p_action: 'acknowledged',
})
assert((await row('employee', id)).acknowledged_at)
r = await row('employee', id)
const {
  data: { user: employee },
} = await clients.employee.auth.getUser()
assert.equal(
  (
    await clients.employee
      .from('request_receipts')
      .upsert({ user_id: employee.id, request_id: id, seen_version: r.version })
  ).error,
  null,
)
assert(
  (
    await clients['manager-it']
      .from('request_receipts')
      .upsert({ user_id: employee.id, request_id: id, seen_version: r.version })
  ).error,
  'Cannot mark for another user',
)
await rpc('admin', 'save_routing', { p_category: category, p_manager: null })
const reserved = await rpc('employee', 'submit_with_files', {
  ...args,
  p_key: randomUUID(),
  p_title: 'E2E reserve · ' + category,
  p_files: [],
})
assert.equal(
  (await row('admin', reserved)).assignee_id,
  null,
  'Disabled route falls back to reserve',
)
await rpc('admin', 'dashboard_action', {
  p_id: reserved,
  p_version: 1,
  p_action: 'assigned',
  p_assignee: manager.id,
})
assert.equal((await row('employee', reserved)).assignee_id, manager.id)
const invalid = await clients.employee.rpc('submit_with_files', {
  ...args,
  p_key: randomUUID(),
  p_files: Array(4).fill(args.p_files[0]),
})
assert(invalid.error, 'Four files rejected')
await rpc('admin', 'save_category', {
  p_id: category,
  p_name: 'Демо · проверка маршрута',
  p_active: false,
  p_department: 'E2E',
  p_days: 2,
})
const serviceKey = process.env.SUPABASE_SECRET_KEY
if (serviceKey) {
  const service = createClient(url, serviceKey, {
    auth: { persistSession: false },
  })
  assert.equal(
    (
      await service
        .from('requests')
        .update({ is_demo: true })
        .in('id', [id, reserved])
    ).error,
    null,
  )
}
for (const c of Object.values(clients)) await c.auth.signOut({ scope: 'local' })
console.log(
  'PASS: creation + praise + atomic files + idempotency + due dates + RLS + review + clarification + reply + metadata + optimistic conflict + comments + result + acknowledgement + receipts + reserve + admin assignment + category archive',
)
console.log('Synthetic requests:', id, reserved)
