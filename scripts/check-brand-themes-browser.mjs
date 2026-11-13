const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright')
import {mkdir,writeFile} from 'node:fs/promises'
import assert from 'node:assert/strict'
const browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_EXECUTABLE_PATH || undefined,args:['--no-sandbox']})
const base=process.env.P0_BASE_URL || 'http://localhost:3000';
const out='docs/evidence/brand-themes';await mkdir(out,{recursive:true})
const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message))
const results=[]
await page.goto(base);assert.equal(await page.locator('html').getAttribute('data-color-theme'),'blue')
for(const mode of ['light','dark']) {
 await page.context().addCookies([{name:'kinetria_theme',value:mode,url:base}])
 await page.goto(base);await page.locator('.new-landing').waitFor()
 assert.equal(await page.locator('section').count(),6)
 await page.getByRole('button',{name:'Руководитель',exact:true}).click();assert.ok(await page.getByText('Проверяете входящий поток').count())
 for(const theme of ['blue','purple']) {
  await page.getByRole('combobox').last().selectOption(theme)
  await page.reload();assert.equal(await page.locator('html').getAttribute('data-color-theme'),theme)
  for(const width of [320,390,768,1440]) {
   await page.setViewportSize({width,height:1000});await page.screenshot({path:`${out}/landing-${mode}-${theme}-${width}.png`,fullPage:true})
   const state=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,primary:getComputedStyle(document.documentElement).getPropertyValue('--primary')}));results.push({route:'/',mode,theme,...state});assert.ok(state.scroll<=width,JSON.stringify(results.at(-1)))
  }
 }
 await page.goto(base+'/login');await page.locator('.entry-page').waitFor()
 for(const theme of ['blue','purple']) {
  await page.getByRole('combobox').last().selectOption(theme)
  for(const width of [320,1440]) {await page.setViewportSize({width,height:1000});await page.screenshot({path:`${out}/login-${mode}-${theme}-${width}.png`,fullPage:true});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth))}
 }
 const account=page.locator('[data-account="employee"]'); if(await account.count()) {
  await account.click();await page.waitForURL('**/workspace/employee?view=*',{timeout:60000});await page.goto(base+'/workspace/employee?view=overview')
  for(const theme of ['blue','purple']) {await page.getByRole('combobox').last().selectOption(theme);for(const width of [320,390,768,1440]) {await page.setViewportSize({width,height:1000});await page.screenshot({path:`${out}/dashboard-${mode}-${theme}-${width}.png`,fullPage:true});const state=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth}));results.push({route:'dashboard',mode,theme,...state});assert.ok(state.scroll<=width,JSON.stringify(results.at(-1)))}}
 }
}
await writeFile(`${out}/report.json`,JSON.stringify({results,errors},null,2));assert.deepEqual(errors,[])
for (const [locale,heading] of [['en','Turn employee ideas'],['kk','Қызметкерлердің идеялары']]) {
 await page.context().addCookies([{name:'kinetria_locale',value:locale,url:base}]);await page.goto(base);await page.setViewportSize({width:320,height:1000});assert.ok((await page.locator('h1').innerText()).startsWith(heading));assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
}
await browser.close();console.log('Passed',results.length,'viewport/theme checks; no browser errors')
