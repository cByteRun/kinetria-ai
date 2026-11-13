import assert from 'node:assert/strict'
import {pathToFileURL} from 'node:url'
import {mkdir,writeFile} from 'node:fs/promises'
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE?pathToFileURL(process.env.PLAYWRIGHT_MODULE).href:'playwright')
const {default:pg}=await import(process.env.TOPIC_PG_MODULE?pathToFileURL(process.env.TOPIC_PG_MODULE).href:'pg')
if(!process.env.PGUSER || !process.env.PGPASSWORD) throw new Error('Set PGUSER and PGPASSWORD for the isolated local database')
const db=new pg.Client({host:'127.0.0.1',port:54322,user:process.env.PGUSER,password:process.env.PGPASSWORD,database:'postgres'})
await db.connect()
const browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_EXECUTABLE_PATH||undefined,args:['--no-sandbox']})
const base=process.env.P0_BASE_URL||'http://localhost:3014',checks=[],errors=[],created=[]
let createdLink=null
const context=await browser.newContext({viewport:{width:1440,height:1000}}),page=await context.newPage()
page.on('pageerror',error=>errors.push(error.message))
const pass=message=>{checks.push(message);console.log('PASS',message)}
async function login(account,role=account){await page.goto(base+'/login');await page.locator('[data-account="'+account+'"]').click();await page.waitForURL(role==='client'?'**/feedback':'**/workspace/'+role+'**',{timeout:30000})}
const out='docs/evidence/topics';await mkdir(out,{recursive:true})
try{
 assert.equal((await context.request.get(base+'/api/topics')).status(),403)
 pass('anonymous topic API denied')
 await login('handler')
 await page.goto(base+'/workspace/handler?view=registry')
 await page.locator('[data-request-search]').fill('Синтетический пример на основе A-003')
 await page.waitForFunction(()=>document.querySelectorAll('.case-table tbody tr').length===4)
 await page.getByRole('button',{name:'Выбрать группу похожих обращений',exact:true}).click()
 await page.getByRole('button',{name:'✨ Сгенерировать тему с ИИ',exact:true}).click()
 await page.locator('.topic-draft').first().waitFor({timeout:30000})
 assert((await page.locator('.topic-draft').innerText()).includes('(4)'))
 const saving=page.waitForResponse(response=>response.url().endsWith('/api/topics')&&response.request().method()==='POST')
 await page.getByRole('button',{name:'Сохранить тему в реестре',exact:true}).click()
 const savedId=(await (await saving).json()).id;created.push(savedId)
 await page.getByRole('status').filter({hasText:'Тема сохранена в общем реестре.'}).waitFor()
 let list=await (await context.request.get(base+'/api/topics')).json()
 const webTopic=list.topics.find(t=>t.id===savedId)
 assert(webTopic);assert.equal(webTopic.ticketIds.length,4)
 assert.equal(await page.locator('.topic-delete').count(),0)
 assert.equal((await context.request.delete(base+'/api/topics/'+webTopic.id)).status(),403)
 await page.reload();await page.locator('.topic-chip').filter({hasText:webTopic.title}).waitFor()
 pass('handler: select → generate (mock AI) → save → reload; exact count; DELETE denied')
 const handler=(await db.query("select p.id,l.telegram_id from public.profiles p join auth.users u on u.id=p.id left join public.telegram_links l on l.user_id=p.id where u.email='handler@kinetria.example'")).rows[0]
 if(!handler.telegram_id){handler.telegram_id=876543210;await db.query('insert into public.telegram_links(telegram_id,user_id) values($1,$2)',[handler.telegram_id,handler.id]);createdLink=handler.telegram_id}
 const botList=(await db.query("select public.telegram_bridge($1,'topics',$2) as data",[handler.telegram_id,{op:'list'}])).rows[0].data
 assert(botList.some(t=>t.id===webTopic.id))
 const botTopic={id:crypto.randomUUID(),title:'QA Telegram '+Date.now(),ticketIds:webTopic.ticketIds,isAiGenerated:true}
 await db.query("select public.telegram_bridge($1,'topics',$2)",[handler.telegram_id,{op:'save',data:botTopic}]);created.push(botTopic.id)
 await page.locator('.topic-chip').filter({hasText:botTopic.title}).waitFor({timeout:10000})
 pass('web save readable by bot; Telegram bridge save appears in open web registry without reload')
 for(const palette of ['blue','purple'])for(const theme of ['light','dark'])for(const width of [320,768,1440]){
  await page.setViewportSize({width,height:1000});await page.evaluate(({palette,theme})=>{document.documentElement.dataset.colorTheme=palette;document.documentElement.dataset.theme=theme},{palette,theme})
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`registry overflow ${width}`)
 }
 await page.screenshot({path:out+'/registry.png',fullPage:true})
 pass('registry fits 320/768/1440, both themes and palettes')
 await login('manager')
 await page.goto(base+'/workspace/manager?view=registry')
 assert.equal((await context.request.delete(base+'/api/topics/'+webTopic.id)).status(),403)
 const managerRows=(await db.query("select r.id from public.requests r join kinetria_private.manager_categories m on m.category_id=r.category_id join auth.users u on u.id=m.manager_id where u.email='manager@kinetria.example' limit 2")).rows
 const response=await context.request.post(base+'/api/topics',{data:{id:crypto.randomUUID(),title:'QA Manager '+Date.now(),isAiGenerated:true,ticketIds:managerRows.map(r=>r.id)}})
 assert.equal(response.status(),201);created.push((await response.json()).id)
 pass('manager: own scope can save, deletion denied')
 await login('admin');await page.goto(base+'/workspace/admin?view=routing');assert.equal(await page.locator('.qvin-panel').count(),0)
 await page.goto(base+'/workspace/admin?view=registry');await page.locator('.topic-delete').first().waitFor()
 assert.equal((await context.request.delete(base+'/api/topics/'+webTopic.id)).status(),204)
 await page.locator('.topic-chip').filter({hasText:webTopic.title}).waitFor({state:'hidden',timeout:10000})
 pass('admin deletion updates web; Qvin removed from routing')
 await login('employee');await page.goto(base+'/workspace/employee?view=registry');assert.equal(await page.locator('.topic-action-bar').count(),0)
 assert.equal((await context.request.post(base+'/api/topics',{data:{}})).status(),403)
 await page.goto(base+'/feedback');await page.locator('.portal-metric').first().waitFor()
 for(const theme of ['light','dark'])for(const width of [320,768,1440]){
  await page.setViewportSize({width,height:1000});await page.evaluate(theme=>document.documentElement.dataset.theme=theme,theme)
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`feedback overflow ${width}`)
  await page.screenshot({path:out+'/feedback-'+theme+'-'+width+'.png',fullPage:true})
 }
 pass('employee: topic actions denied; feedback dashboard fits mobile/tablet/desktop and light/dark')
 assert.deepEqual(errors,[])
}finally{
 if(createdLink)await db.query('delete from public.telegram_links where telegram_id=$1',[createdLink])
 for(const id of created)await db.query('delete from public.topics where id=$1',[id])
 await writeFile(out+'/browser.json',JSON.stringify({checks,errors,ai:'deterministic mocked provider',database:'local Supabase'},null,2))
 await browser.close();await db.end()
}
