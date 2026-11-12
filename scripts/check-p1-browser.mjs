import { pathToFileURL } from 'node:url'
import { mkdir, writeFile } from 'node:fs/promises'
import assert from 'node:assert/strict'
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE ? pathToFileURL(process.env.PLAYWRIGHT_MODULE).href : 'playwright')
const base=process.env.P0_BASE_URL || 'http://localhost:3000'
const out='docs/evidence/p1'
await mkdir(out,{recursive:true})
const browser=await chromium.launch({headless:true,args:['--no-sandbox'],...(process.env.PLAYWRIGHT_EXECUTABLE_PATH?{executablePath:process.env.PLAYWRIGHT_EXECUTABLE_PATH}:{})})
const report={checks:[],errors:[],screenshots:[]}
const pass=name=>{report.checks.push(name);console.log('PASS',name)}
try {
 for (const role of ['employee','handler','manager','admin']) {
  const context=await browser.newContext({viewport:{width:1440,height:1000}})
  const page=await context.newPage(); page.on('pageerror',e=>report.errors.push(e.message))
  await page.goto(base+'/login');await page.locator(`button[data-account="${role}"]`).click();await page.waitForURL('**/workspace/'+role+'?view=*')
  await page.locator('.command-trigger').click();await page.locator('.command-dialog[open]').waitFor()
  await page.keyboard.press('Escape');await page.keyboard.press('Control+k');await page.locator('.command-dialog[open]').waitFor()
  const options=await page.locator('.command-results [role=option]').allTextContents()
  assert(options.length>=6)
  assert.equal(options.some(s=>s.includes('Настроить категории')),role==='admin')
  assert.equal(options.some(s=>s.includes('Создать проблему')),role==='employee')
  if(role==='employee') assert(!options.some(s=>s.includes('Повторяющиеся проблемы')))
  await page.getByRole('combobox',{name:'Найти экран или действие…'}).fill('маршрут')
  await page.keyboard.press('ArrowDown');await page.keyboard.press('Enter');await page.waitForURL(/view=help/)
  await page.getByRole('button',{name:'Создать ссылку привязки',exact:true}).click()
  const link=page.getByRole('link',{name:'Открыть Telegram и подтвердить привязку'})
  await link.waitFor(); assert.match(await link.getAttribute('href'),/^https:\/\/t.me\/VoiceChatGpt_Custom_bot\?start=[0-9a-f-]{36}$/)
  pass(role+': role-scoped palette, keyboard navigation, real account link token')
  if(role==='employee') {
   await page.goto(base+'/workspace/employee?view=new')
   assert.equal(await page.locator('input[type=file]').isVisible(),false)
   assert.equal(await page.locator('[name=tags]').isVisible(),true)
   await page.locator('input[type=file]').setInputFiles({name:'p1-synthetic.txt',mimeType:'text/plain',buffer:Buffer.from('Synthetic P1 material')})
   await page.locator('.attachment').filter({hasText:'p1-synthetic.txt'}).waitFor()
   await page.locator('.attachment button').click(); assert.equal(await page.locator('.attachment').count(),0)
   pass('employee: hidden native upload, visible tags, attachment add/remove')
   for (const theme of ['light','dark']) {
    await context.addCookies([{name:'kinetria_theme',value:theme,url:base}]);await page.reload()
    assert.equal(await page.locator('html').getAttribute('data-theme'),theme)
    await page.keyboard.press('Control+k');await page.locator('.command-dialog[open]').waitFor()
    const name='palette-'+theme+'.png';await page.screenshot({path:out+'/'+name});report.screenshots.push(name)
    await page.keyboard.press('Escape');assert.equal(await page.locator('.command-dialog').evaluate(d=>d.open),false)
    await page.setViewportSize({width:320,height:850});await page.reload()
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'No horizontal overflow')
    const mobile='new-'+theme+'-320.png';await page.screenshot({path:out+'/'+mobile,fullPage:true});report.screenshots.push(mobile)
    await page.setViewportSize({width:1440,height:1000})
   }
   pass('employee: light/dark persistence, dialog Escape and 320px layout')
  }
  await context.close()
 }
 const response=await fetch(base+'/api/telegram/webhook',{method:'POST',headers:{'Content-Type':'application/json'},body:'{"update_id":1}'})
 assert.equal(response.status,401)
 const retry=await fetch(base+'/api/telegram/deliver',{method:'POST'})
 assert.equal(retry.status,401)
 pass('Webhook and delivery endpoint reject unauthenticated requests')
 assert.deepEqual(report.errors,[])
} finally {await writeFile(out+'/report.json',JSON.stringify(report,null,2));await browser.close()}
