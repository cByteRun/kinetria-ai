import assert from 'node:assert/strict'
import {pathToFileURL} from 'node:url'
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE ? pathToFileURL(process.env.PLAYWRIGHT_MODULE).href : 'playwright')
const browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_EXECUTABLE_PATH||undefined,args:['--no-sandbox']})
const context=await browser.newContext({viewport:{width:1440,height:1000}}),page=await context.newPage()
const base=process.env.P0_BASE_URL||'http://localhost:3000',errors=[];page.on('pageerror',e=>errors.push(e.message))
try{
 for(const role of ['admin','handler','manager','employee']) {
  await page.goto(base+'/login');await page.locator(`[data-account="${role}"]`).click();
  await page.waitForURL(`**/workspace/${role}?view=overview`,{timeout:30000});console.log('PASS default route',role)
 }
 await page.goto(base+'/login');await page.locator('[data-account="admin"]').click();await page.waitForURL('**/workspace/admin?view=overview')
 await page.goto(base+'/workspace/admin?view=registry&mode=board');await page.locator('.board-card').first().waitFor()
 assert(await page.locator('.brand-lockup').innerText().then(s=>s.includes('IdeaRoute')))
 const toolbar=await page.locator('.topic-action-bar').boundingBox(),board=await page.locator('.board').boundingBox();assert(toolbar.y+toolbar.height<=board.y)
 await page.screenshot({path:'/tmp/ir-board.png',fullPage:true})
 const ids=await page.locator('.board-card').evaluateAll(links=>links.map(l=>new URL(l.href).searchParams.get('id')))
 await page.locator('.board-card').first().click();await page.locator('dialog[open]').waitFor();assert(await page.locator('.board').count());await page.keyboard.press('Escape');await page.waitForFunction(()=>!document.querySelector('dialog[open]'));assert(page.url().includes('mode=board'));console.log('PASS drawer and toolbar')
 const invalid=await context.request.post(base+'/api/topics/generate',{data:{ids:ids.slice(0,1)}});assert.equal(invalid.status(),400)
 await page.locator('.topic-prompt').fill('Найди повторяющиеся конкретные проблемы. Объединяй только подтверждённые примеры.');const waiting=page.waitForResponse(r=>r.url().endsWith('/api/topics/generate')&&r.request().method()==='POST',{timeout:120000});await page.locator('.topic-actions .primary').first().click();const generated=await waiting;const result=await generated.json();console.log('Generation HTTP',generated.status());assert.equal(generated.status(),200);assert(Array.isArray(result.topics));console.log('PASS admin authorized generation',ids.length)
 await page.goto(base+'/workspace/admin?view=insights');await page.locator('.topic-frequency-table').waitFor()
 for(const width of [1440,768,390,320]){await page.setViewportSize({width,height:1000});await page.screenshot({path:`/tmp/ir-topics-${width}.png`,fullPage:true});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'overflow '+width)}console.log('PASS recurring responsive')
 await page.goto(base+'/login');await page.locator('[data-account="employee"]').click();await page.waitForURL('**/workspace/employee?view=overview');const denied=await context.request.post(base+'/api/topics/generate',{data:{ids:ids.slice(0,2)}});assert.equal(denied.status(),403);console.log('PASS employee denied')
 assert.deepEqual(errors,[]);console.log('PASS no browser errors')
}finally{await browser.close()}
