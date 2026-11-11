import assert from 'node:assert/strict'
import { createClient } from '@supabase/supabase-js'

const clients = {}
for (const role of ['admin', 'manager-it', 'manager']) {
  const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, {auth:{persistSession:false,autoRefreshToken:false}})
  const {data,error} = await client.auth.signInWithPassword({email:role+'@kinetria.example',password:process.env.KINETRIA_DEMO_PASSWORD})
  assert.equal(error,null)
  clients[role] = {client,id:data.user.id}
}
const admin = clients.admin.client
const preview = await admin.rpc('routing_preview')
assert.equal(preview.error,null)
assert.equal(preview.data.find(x=>x.category_id==='it').recipient,'Максим Ли', 'Expected synthetic route before testing')
const denied = await clients.manager.client.rpc('save_routing',{p_category:'it',p_manager:clients.manager.id})
assert.equal(denied.error?.code,'42501')
console.log('PASS non-admin cannot edit routing')
try {
  const change = await admin.rpc('save_routing',{p_category:'it',p_manager:clients.manager.id})
  assert.equal(change.error,null)
  const updated = await admin.rpc('routing_preview')
  assert.equal(updated.data.find(x=>x.category_id==='it').recipient,'Алексей Волков')
  for (const role of ['manager-it','manager']) {
    const {data,error}=await clients[role].client.from('requests').select('id').eq('category_id','it')
    assert.equal(error,null)
    assert.equal(data.length>0,role==='manager')
  }
  console.log('PASS admin changes route and manager visibility')
} finally {
  const restore = await admin.rpc('save_routing',{p_category:'it',p_manager:clients['manager-it'].id})
  assert.equal(restore.error,null)
  const restored = await admin.rpc('routing_preview')
  assert.equal(restored.data.find(x=>x.category_id==='it').recipient,'Максим Ли')
  console.log('PASS original route restored')
  for (const {client} of Object.values(clients)) await client.auth.signOut({scope:'local'})
}
