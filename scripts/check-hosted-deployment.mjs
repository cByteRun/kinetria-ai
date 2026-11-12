// Read-only smoke checks against the deployed app and role-scoped Data API.
import assert from 'node:assert/strict'
import {createClient} from '@supabase/supabase-js'
const base=process.env.APP_URL
const headers={'x-telegram-bot-api-secret-token':process.env.TELEGRAM_WEBHOOK_SECRET}
const get=async(path,init={})=>fetch(base+path,{...init,signal:AbortSignal.timeout(20000)})
const health=await get('/api/telegram/webhook',{headers});assert.equal(health.status,200);assert.equal((await health.json()).database,'ready')
assert.equal((await get('/api/telegram/webhook')).status,401)
const invalid=await get('/api/telegram/webhook',{method:'POST',headers,body:'null'});assert.equal(invalid.status,400)
const ignored=await get('/api/telegram/webhook',{method:'POST',headers,body:JSON.stringify({update_id:1})});assert.equal(ignored.status,200)
console.log('PASS hosted webhook: database ready, secret enforced, invalid update rejected, valid ignored update acknowledged')
for(const [account,role] of [['employee','employee'],['handler','handler'],['manager-it','manager'],['admin','admin']]) {
 const db=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}})
 const login=await db.auth.signInWithPassword({email:account+'@kinetria.example',password:process.env.KINETRIA_DEMO_PASSWORD});assert.ifError(login.error)
 const profile=await db.from('profiles').select('role').eq('id',login.data.user.id).single();assert.ifError(profile.error);assert.equal(profile.data.role,role)
 const list=await db.from('requests').select('id');assert.ifError(list.error)
 const response=await get('/auth/login',{method:'POST',headers:{origin:base},body:new URLSearchParams({account}),redirect:'manual'})
 assert.equal(response.status,303);assert.equal(new URL(response.headers.get('location'),base).pathname,'/workspace/'+role)
 const cookies=response.headers.getSetCookie().map(x=>x.split(';')[0]).join('; ')
 assert(cookies,'Login must issue session cookies')
 const workspace=await get('/workspace/'+role+'?view=registry',{headers:{cookie:cookies}});assert.equal(workspace.status,200)
 const html=await workspace.text();assert(html.includes('IdeaRoute'));assert(!html.includes('NEXT_HTTP_ERROR_FALLBACK'))
 await db.auth.signOut({scope:'local'})
 console.log('PASS hosted '+role+': Auth, profile, RLS registry ('+list.data.length+'), web login cookie and workspace')
}
