import assert from 'node:assert/strict'
import { pathToFileURL } from 'node:url'
import { mkdir, writeFile } from 'node:fs/promises'
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ? pathToFileURL(process.env.PLAYWRIGHT_MODULE).href : 'playwright')
const base = process.env.P0_BASE_URL || 'http://localhost:3016'
const out = 'docs/evidence/search-lifecycle'
await mkdir(out, { recursive: true })
const browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH || undefined, args: ['--no-sandbox'] })
const report = { checks: [], errors: [], screenshots: [] }
const context = await browser.newContext()
const page = await context.newPage()
page.on('pageerror', e => report.errors.push(e.message))
const pass = name => { report.checks.push(name); console.log('PASS', name) }
async function palette() { await page.locator('.command-trigger').click(); await page.locator('.command-dialog[open]').waitFor() }
try {
 for (const role of ['employee','handler','manager','admin']) {
  await page.goto(base + '/login'); await page.locator(`[data-account="${role}"]`).click(); await page.waitForURL(`**/workspace/${role}?view=*`)
  await palette()
  const ids = await page.locator('.command-results [role=option]').evaluateAll(es => es.map(e => e.id))
  assert.equal(ids.includes('cmd-routing'),role==='admin')
  assert.equal(ids.includes('cmd-new'),role==='employee')
  assert.equal(ids.includes('cmd-analytics'),role!=='employee')
  assert.equal(ids.includes('cmd-qvin'),role==='admin'||role==='manager')
  await page.keyboard.press('Escape'); pass(role + ' role navigation')
 }
 await page.goto(base + '/workspace/admin?view=registry&mode=board')
 await page.locator('.board-card').first().waitFor()
 for (const locale of ['ru','en']) for (const theme of ['light','dark']) {
  await context.addCookies([{ name:'kinetria_locale',value:locale,url:base },{ name:'kinetria_theme',value:theme,url:base }])
  await page.reload(); await page.locator('.board-card').first().waitFor()
  for (const [width,height] of [[1440,900],[1280,800],[390,844],[360,800]]) {
   await page.setViewportSize({width,height})
   const geometry = await page.evaluate(() => ({ width:innerWidth,scroll:document.documentElement.scrollWidth,header:document.querySelector('.global-header').getBoundingClientRect().height, board:document.querySelector('.board').scrollWidth,boardWidth:document.querySelector('.board').clientWidth, nested:[...document.querySelectorAll('.board-col')].some(e => ['auto','scroll'].includes(getComputedStyle(e).overflowY)) }))
   assert(geometry.scroll<=width,JSON.stringify(geometry));assert.equal(geometry.header,56);assert(geometry.board<=geometry.boardWidth+1,JSON.stringify(geometry));assert(!geometry.nested)
   assert(await page.locator('.command-trigger').isVisible())
   if(width>=1024) { assert(await page.locator('.shell-search').isVisible()); assert(await page.locator('.search-divider').isVisible()); assert.equal(await page.locator('.side-manifesto').count(),0); assert(await page.locator('.ir-navigation').evaluate(e=>e.scrollHeight<=e.clientHeight+1),'sidebar must show every item'); }
   const name=`${locale}-${theme}-${width}`; await page.screenshot({path:`${out}/${name}.png`,fullPage:true,caret:'initial'});await page.screenshot({path:`${out}/${name}-viewport.png`,caret:'initial'});report.screenshots.push(name+'.png');pass(name+' geometry')
  }
 }
 await page.keyboard.press('Control+k'); await page.locator('.command-dialog[open]').waitFor()
 await page.keyboard.press('ArrowDown');assert.equal(await page.locator('[aria-selected=true]').getAttribute('id'),'cmd-portal')
 await page.keyboard.press('ArrowUp');await page.keyboard.press('Enter');await page.waitForURL('**/workspace/admin?view=registry&mode=board');pass('keyboard arrows + Enter')
 await page.keyboard.press('Meta+k'); await page.locator('.command-dialog[open]').waitFor(); await page.keyboard.press('Escape');assert(await page.locator('.command-trigger').evaluate(e=>e===document.activeElement));pass('Cmd+K, Esc and focus return')
 await palette(); await page.locator('.command-search input').fill('A-001'); assert(await page.locator('.command-results [role=option]').count()>0); await page.keyboard.press('Enter');await page.waitForURL('**/workspace/admin?view=registry&id=*');await page.locator('.crm-request-drawer[open]').waitFor();await page.keyboard.press('Escape');pass('request ID search opens card')
 await page.goto(base + '/workspace/admin?view=registry&action=qvin'); await page.waitForFunction(()=>document.querySelector('.qvin-panel')?.open);pass('Qvin quick action')
 await page.goto(base + '/workspace/admin?view=registry&action=topic');await page.waitForFunction(()=>document.activeElement?.closest('.topic-action-bar'));pass('AI topic quick action')
 await palette();await page.locator('#cmd-theme').click();await page.waitForFunction(()=>document.documentElement.dataset.theme==='light');pass('theme quick action')
 await page.waitForFunction(()=>document.querySelector('.preferences').getAttribute('aria-busy')==='false');await palette();await page.locator('#cmd-language-ru').click();await page.waitForFunction(()=>document.documentElement.lang==='ru');pass('language quick action')
 await palette();await page.locator('.command-search input').fill('zzzz-no-match');assert.equal(await page.locator('.command-results [role=option]').count(),0);await page.keyboard.press('ArrowDown');await page.keyboard.press('Escape');pass('empty results keyboard')
 assert.deepEqual(report.errors,[]);pass('no browser errors')
} finally { await writeFile(out+'/report.json',JSON.stringify(report,null,2)+'\n');await browser.close() }
