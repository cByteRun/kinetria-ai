// Explicit integration check against the configured database; creates and removes one QA topic.
import assert from 'node:assert/strict'
import {pathToFileURL} from 'node:url'
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE ? pathToFileURL(process.env.PLAYWRIGHT_MODULE).href : 'playwright')
process.loadEnvFile('.env.local')
const browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_EXECUTABLE_PATH||undefined,args:['--no-sandbox']})
const context=await browser.newContext({viewport:{width:1440,height:1000}}),page=await context.newPage()
const errors=[];page.on('pageerror',e=>errors.push(e.message));let created
const base=process.env.P0_BASE_URL||'http://localhost:3000'
try {
 await page.goto(base+'/login');await page.locator('[data-account="admin"]').click();await page.waitForURL('**/workspace/admin**')
 await page.goto(base+'/workspace/admin?view=insights')
 await page.getByRole('heading',{name:'Мониторинг сохранённых тем',exact:true}).waitFor()
 const initial=await context.request.get(base+'/api/topics');assert.equal(initial.status(),200)
 const k=process.env.SUPABASE_SECRET_KEY
 const response=await fetch(process.env.NEXT_PUBLIC_SUPABASE_URL+'/rest/v1/requests?select=id&source_ref=like.SYN-003-*&order=source_ref',{headers:{apikey:k,Authorization:'Bearer '+k}})
 const members=await response.json();assert.equal(members.length,4)
 const id=crypto.randomUUID(),title='QA monitoring '+Date.now()
 const saved=await context.request.post(base+'/api/topics',{data:{id,title,isAiGenerated:false,ticketIds:members.map(row=>row.id)}})
 assert.equal(saved.status(),201);created=id
 const card=page.locator('article.recurrence-topic').filter({hasText:title});await card.waitFor({timeout:15000})
 assert((await card.innerText()).includes('Обращений: 4'));assert.equal(await card.locator('a').count(),4)
 await page.reload();await page.locator('article.recurrence-topic').filter({hasText:title}).waitFor()
 console.log('PASS hosted save → automatic monitoring update → exact count and links → reload')
 for(const theme of ['light','dark'])for(const width of [320,768,1440]){
  await page.setViewportSize({width,height:1000});await page.evaluate(theme=>{document.documentElement.dataset.colorTheme='purple';document.documentElement.dataset.theme=theme},theme)
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'overflow '+theme+' '+width)
  const colors=await page.locator('.ir-app').evaluate(el=>{const c=getComputedStyle(el);return {green:c.getPropertyValue('--green').trim(),brand:c.getPropertyValue('--accent-readable').trim()}})
  assert.equal(colors.green,colors.brand)
  await page.screenshot({path:'/tmp/hosted-topics-purple-'+theme+'-'+width+'.png',fullPage:true})
 }
 console.log('PASS purple light/dark, 320/768/1440, consistent positive tone, no horizontal overflow')
 const deleted=await context.request.delete(base+'/api/topics/'+id);assert.equal(deleted.status(),204);created=null
 await page.locator('article.recurrence-topic').filter({hasText:title}).waitFor({state:'hidden',timeout:15000})
 assert.deepEqual(errors,[]);console.log('PASS delete updates monitoring; no browser errors; test topic removed')
} finally {if(created)await context.request.delete(base+'/api/topics/'+created);await browser.close()}
