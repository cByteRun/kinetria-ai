import assert from 'node:assert/strict'
import { pathToFileURL } from 'node:url'
import { mkdir, writeFile } from 'node:fs/promises'
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ? pathToFileURL(process.env.PLAYWRIGHT_MODULE).href : 'playwright')
const base = process.env.P0_BASE_URL || 'http://localhost:3000'
const out = process.env.MOBILE_OUTPUT || 'docs/evidence/mobile-first'
await mkdir(out, { recursive: true })
const browser = await chromium.launch({headless:true, executablePath:process.env.PLAYWRIGHT_EXECUTABLE_PATH || undefined,args:['--no-sandbox']})
const report={checks:[],errors:[],screenshots:[]}
const context=await browser.newContext({viewport:{width:360,height:800}})
await context.addCookies([{name:'kinetria_theme',value:'light',url:base}])
const page=await context.newPage()
page.on('pageerror',e=>report.errors.push(e.message))
async function capture(name){await page.screenshot({path:`${out}/${name}.png`,fullPage:true});report.screenshots.push(name+'.png')}
async function geometry(name){
 await page.locator('.global-header').waitFor({state:'visible'})
 const result=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,offenders:[...document.querySelectorAll('main *')].filter(e=>{const r=e.getBoundingClientRect();return r.width&&r.right>innerWidth+1&&getComputedStyle(e).position!=='absolute'}).slice(0,8).map(e=>e.className)}))
 assert(result.scroll<=result.width,`${name}: ${JSON.stringify(result)}`)
 if(result.width<768){assert.equal(await page.locator('.global-header').evaluate(e=>e.getBoundingClientRect().height),56,`${name}: header`)}
 if(result.width<768){
  const controls=await page.locator('.global-header .preferences :is(button,select), .global-header-cta, .global-brand').evaluateAll(es=>es.map(e=>({name:e.getAttribute('aria-label')||e.textContent,r:e.getBoundingClientRect().toJSON()})))
  for(const {name:label,r} of controls)assert(r.x>=0&&r.y>=0&&r.right<=result.width&&r.bottom<=56,`${name} header control ${label}: ${JSON.stringify(r)}`)
 }
 report.checks.push(name)
}
try{
 for(const route of ['/','/login']){
  await page.goto(base+route)
  for(const width of [360,390,430,768,1440]){await page.setViewportSize({width,height:900});await geometry(`${route} ${width}`)}
  await page.setViewportSize({width:360,height:800});await capture(route==='/'?'landing':'login')
 }
 for(const [account,role] of [['employee','employee'],['manager-it','manager'],['handler-catalog','handler'],['admin','admin'],['client','client']]){
  if(process.env.MOBILE_TEST_ROLES&&!process.env.MOBILE_TEST_ROLES.split(',').includes(role))continue
  await page.goto(base+'/login');await page.locator(`[data-account="${account}"]`).click();await page.waitForURL(role==='client'?'**/feedback':'**/workspace/**',{timeout:60000})
  const views=role==='client'?[]:['overview','registry','results','notifications','help','profile',...(role==='employee'?['new']:['analytics','insights']),...(role==='admin'?['categories','routing']:[])]
  for(const view of views){
   console.log(role,view)
   await page.goto(`${base}/workspace/${role}?view=${view}`)
   await page.locator('main h1').first().waitFor()
   for(const width of [360,390,430,768,1024,1440]){await page.setViewportSize({width,height:900});await geometry(`${role}/${view} ${width}`)}
   await page.setViewportSize({width:390,height:844})
   assert.equal(await page.locator('.sidebar').isVisible(),false)
   const expected=await page.locator('.sidebar a.nav-link').evaluateAll(a=>a.map(e=>e.getAttribute('href')))
   await page.locator('.mobile-more').click();await page.locator('.mobile-nav-sheet[open]').waitFor()
   const actual=await page.locator('.mobile-nav-sheet a').evaluateAll(a=>a.map(e=>e.getAttribute('href')))
   for(const href of expected)assert(actual.includes(href),`${role} missing ${href}`)
   await geometry(`${role}/${view} menu`)
   await page.keyboard.press('Escape');assert(await page.locator('.mobile-more').evaluate(e=>e===document.activeElement))
   if(['overview','new','insights','categories','routing','portal'].includes(view))await capture(`${role}-${view}`)
   if(view==='registry'){
    const link=page.locator('.case-title').first()
    if(await link.count()){
     await link.click();await page.locator('dialog[open].crm-request-drawer').waitFor()
     for(const width of [360,390,430]){await page.setViewportSize({width,height:844});await geometry(`${role}/drawer ${width}`);assert.equal(await page.locator('.crm-request-drawer').evaluate(e=>e.clientWidth),width)}
     assert.equal(await page.locator('.ir-detail').evaluate(e=>getComputedStyle(e).display),'flex');
     await capture(`${role}-drawer`);await page.keyboard.press('Escape');await page.waitForFunction(()=>!document.querySelector('.crm-request-drawer[open]'))
    }
    await page.goto(`${base}/workspace/${role}?view=registry&mode=board`)
    await page.setViewportSize({width:360,height:800});await geometry(`${role}/board`)
    assert.equal(await page.locator('.board').evaluate(e=>getComputedStyle(e).flexDirection),'column')
    await page.locator('.board-status-filters button').nth(1).click();await geometry(`${role}/board filtered`)
    await capture(`${role}-board`)
   }
  }
  await page.locator('.global-header .theme-toggle').click();await page.waitForFunction(()=>document.documentElement.dataset.theme==='dark');await page.waitForFunction(()=>document.querySelector('.global-header .preferences').getAttribute('aria-busy')==='false');await page.reload();assert.equal(await page.locator('html').getAttribute('data-theme'),'dark');await geometry(`${role} dark`);await capture(`${role}-dark`)
  await page.locator('.global-header .theme-toggle').click();await page.waitForFunction(()=>document.documentElement.dataset.theme==='light');await page.waitForFunction(()=>document.querySelector('.global-header .preferences').getAttribute('aria-busy')==='false')
 }
 await page.goto(base+'/feedback')
 for(const width of [360,390,430,768,1440]){await page.setViewportSize({width,height:900});await geometry(`feedback ${width}`)}
 await page.setViewportSize({width:360,height:800});await page.locator('.portal-mobile-tabs a[href="#new-feedback"]').click();await page.locator('input[name=title]').fill('Проверка мобильной подачи');await page.locator('textarea[name=description]').fill('Синтетический черновик, не отправляется в этом layout-тесте.');await capture('feedback-compose')
 for(const locale of ['en','kk','ru']){await page.locator('.preferences select').first().selectOption(locale);await page.waitForFunction(l=>document.documentElement.lang===l,locale);await geometry(`feedback ${locale}`)}
 assert.deepEqual(report.errors,[]);report.status='passed'
}catch(e){report.status='failed';report.failure=e.stack;console.error(e);await capture('failure');process.exitCode=1}
finally{await writeFile(`${out}/report.json`,JSON.stringify(report,null,2));console.log(report.status,report.checks.length,'checks');await browser.close()}
