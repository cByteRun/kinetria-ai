// Reuse the existing P0 lifecycle on a phone. Only an isolated local demo DB is allowed.
import assert from 'node:assert/strict'
import {pathToFileURL} from 'node:url'
const base=process.env.P0_BASE_URL||'http://localhost:3012'
assert(['localhost','127.0.0.1'].includes(new URL(base).hostname),'Local synthetic database only')
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE?pathToFileURL(process.env.PLAYWRIGHT_MODULE).href:'playwright')
const browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_EXECUTABLE_PATH||undefined,args:['--no-sandbox']})
const page=await browser.newPage({viewport:{width:390,height:844}})
let original
async function route(value){await page.goto(base+'/workspace/admin?view=routing');const form=page.locator('form').filter({has:page.locator('input[name=category][value=catalog]')});await form.locator('select').selectOption(value);await form.locator('button').click();await page.waitForURL('**/workspace/admin?view=routing');await page.locator('main h1').first().waitFor()}
try{
 await page.goto(base+'/login');await page.locator('[data-account=admin]').click();await page.waitForURL('**/workspace/admin**')
 await page.goto(base+'/workspace/admin?view=routing');const form=page.locator('form').filter({has:page.locator('input[name=category][value=catalog]')});await form.locator('select').waitFor();const name=(await form.locator('span').first().innerText()).trim();const options=await form.locator('option').evaluateAll(o=>o.map(e=>({name:e.textContent.trim(),value:e.value})));const saved=options.find(o=>o.name===name);assert(saved||name==='Резервная очередь','Cannot safely restore the existing route');original=saved?.value||'disabled';const manager=options.find(o=>o.name==='Максим Ли');assert(manager);await route(manager.value)
 process.env.P0_BASE_URL=base
 process.env.TEST_VIEWPORT_WIDTH='390'
 process.env.P0_OUTPUT='docs/evidence/mobile-first/workflow'
 process.env.P0_EXPECTED_OWNER='Максим Ли'
 process.env.P0_CORE_ONLY='true'
 process.env.P0_ASSIGN_OWNER='Мария Ким'
 process.env.P0_REVIEW_ACCOUNT='handler-catalog'
 await import('./check-p0-browser.mjs')
}finally{if(original!==undefined)await route(original).catch(e=>console.error('Route restore failed',e.message));await browser.close()}
