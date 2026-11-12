import assert from 'node:assert/strict'
import {pathToFileURL} from 'node:url'
import {createClient} from '@supabase/supabase-js'
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE ? pathToFileURL(process.env.PLAYWRIGHT_MODULE).href : 'playwright')
const base=process.env.P0_BASE_URL || 'http://localhost:3000'
const browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_EXECUTABLE_PATH?{executablePath:process.env.PLAYWRIGHT_EXECUTABLE_PATH}:{}),args:['--no-sandbox']})
try {
 for(const [account,role] of [['employee','employee'],['manager-it','manager'],['handler','handler'],['admin','admin']]) {
  const db=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}})
  const {error:authError}=await db.auth.signInWithPassword({email:account+'@kinetria.example',password:process.env.KINETRIA_DEMO_PASSWORD})
  assert.ifError(authError)
  const {data:rows,error}=await db.from('requests').select('id,created_at,number').order('created_at',{ascending:false}).order('number',{ascending:false})
  assert.ifError(error)
  const context=await browser.newContext()
  const errors=[]
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message))
  await page.goto(base+'/login')
  await page.locator('button[name=account][value="'+account+'"]').click()
  await page.waitForURL('**/workspace/'+role)
  await page.goto(base+'/workspace/'+role+'?view=registry')
  await page.getByRole('button',{name:'Список',exact:true}).waitFor()
  assert.equal(await page.getByRole('button',{name:'Список',exact:true}).getAttribute('aria-pressed'),'true')
  assert.equal(await page.getByLabel('Порядок обращений').inputValue(),'newest')
  const ids=await page.locator('a.case-title').evaluateAll(links=>links.map(a=>new URL(a.href).searchParams.get('id')))
  assert.deepEqual(ids,rows.map(r=>r.id),'UI order must equal RLS-scoped creation date order')
  assert.equal(await page.locator('.registry-groups').count(),0)
  if(role!=='employee') {
   await page.getByRole('button',{name:'Темы',exact:true}).click()
   assert.equal(await page.locator('.registry-groups').count(),1)
  }
  assert.deepEqual(errors,[])
  console.log('PASS '+role+': list default, newest first matches RLS data ('+ids.length+'), optional topics, no browser errors')
  await db.auth.signOut();await context.close()
 }
} finally {await browser.close()}
