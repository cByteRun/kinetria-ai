// Explicit live smoke on the requested deployed demo. Creates ONE labeled synthetic request.
import assert from 'node:assert/strict'
import {pathToFileURL} from 'node:url'
import {mkdir,writeFile} from 'node:fs/promises'
const base=process.env.PRODUCTION_CHECK_URL
if(!base||process.env.CONFIRM_PRODUCTION_SMOKE!=='true')throw Error('Set PRODUCTION_CHECK_URL and CONFIRM_PRODUCTION_SMOKE=true')
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE?pathToFileURL(process.env.PLAYWRIGHT_MODULE).href:'playwright')
const browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_EXECUTABLE_PATH||undefined,args:['--no-sandbox']})
const ctx=await browser.newContext({viewport:{width:1440,height:1000}}),page=await ctx.newPage(),errors=[]
page.on('pageerror',e=>errors.push(e.message))
const report={base,started:new Date().toISOString(),checks:[],errors}
try{
 await page.goto(base+'/login');await page.locator('[data-account="employee"]').click();await page.waitForURL('**/workspace/employee**',{timeout:60000});report.checks.push('public demo login')
 if(process.env.PRODUCTION_EXISTING_ID){report.id=process.env.PRODUCTION_EXISTING_ID;await page.goto(base+'/workspace/employee?view=registry&id='+report.id);report.checks.push('resume previously verified real registration')}else{
 await page.goto(base+'/workspace/employee?view=new');await page.locator('[name=title]').fill('Синтетическая проверка регистрации · '+Date.now());await page.locator('textarea[name=description]').fill('Техническая проверка исправления регистрации в размещённом демо. Не является реальным обращением компании.');await page.locator('[name=category]').selectOption('catalog');await page.locator('[name=kind][value=problem]').check();await page.locator('[name=attachments]').setInputFiles({name:'synthetic-check.txt',mimeType:'text/plain',buffer:Buffer.from('Synthetic registration check')});await page.getByRole('button',{name:'Зарегистрировать',exact:true}).click();await page.waitForURL(u=>!!u.searchParams.get('id'),{timeout:60000});report.id=new URL(page.url()).searchParams.get('id');assert(report.id);await page.locator('dialog[open]').waitFor();report.checks.push('real web form → submit_with_impact → persisted UUID → own drawer')
 }
 const link=page.locator('a.attachment').first();const file=await ctx.request.get(new URL(await link.getAttribute('href'),base).href);assert.equal(file.status(),200);assert.equal(await file.text(),'Synthetic registration check');report.checks.push('persisted attachment download and content')
 await page.reload().catch(async error=>{if(!error.message.includes('ERR_NETWORK_CHANGED'))throw error;await page.goto(base+'/workspace/employee?view=registry&id='+report.id)});await page.locator('dialog[open]').waitFor();assert((await page.locator('dialog[open]').innerText()).includes('Синтетическая проверка регистрации'));report.checks.push('persist after reload')
 await page.goto(base+'/login');await page.locator('[data-account="admin"]').click();await page.waitForURL('**/workspace/admin**');await page.goto(base+'/workspace/admin?view=registry&id='+report.id);await page.locator('dialog[open]').waitFor();assert((await page.locator('dialog[open]').innerText()).includes('Синтетическая проверка регистрации'));report.checks.push('same request visible to administrator')
 await page.goto(base+'/feedback');await page.getByRole('heading',{name:'Портал фидбэков',exact:true}).waitFor();assert.equal((await ctx.request.get(base+'/api/topics')).status(),200);report.checks.push('client portal and existing saved topics still available')
 assert.deepEqual(errors,[]);console.log('PASS production registration: login, real submit, file, reload, admin visibility, portal and topics')
}finally{await mkdir('docs/evidence/production-registration',{recursive:true});await page.screenshot({path:'docs/evidence/production-registration/final.png'}).catch(()=>{});await writeFile('docs/evidence/production-registration/report.json',JSON.stringify(report,null,2));await browser.close()}
