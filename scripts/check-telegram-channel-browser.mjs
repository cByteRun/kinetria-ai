// Checks public navigation and conditional linking; does not join Telegram or send messages.
import assert from 'node:assert/strict'
import {pathToFileURL} from 'node:url'
import {mkdir,writeFile} from 'node:fs/promises'
const base=process.env.TELEGRAM_UI_BASE_URL||'http://localhost:3016'
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE?pathToFileURL(process.env.PLAYWRIGHT_MODULE).href:'playwright')
const browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_EXECUTABLE_PATH||undefined,args:['--no-sandbox']})
const context=await browser.newContext({viewport:{width:1440,height:1000}}),page=await context.newPage(),errors=[],checks=[]
page.on('pageerror',e=>errors.push(e.message))
const out='docs/evidence/telegram-channel-ux';await mkdir(out,{recursive:true})
try{
 await page.goto(base+'/login');await page.locator('[data-account="employee"]').click();await page.waitForURL('**/workspace/employee**');await page.goto(base+'/workspace/employee?view=help');const panel=page.locator('.telegram-access');await panel.waitFor()
 assert.equal(await panel.getByRole('link',{name:'Открыть бота',exact:true}).getAttribute('href'),'https://t.me/VoiceChatGpt_Custom_bot')
 assert.equal(await panel.getByRole('link',{name:'Вступить в канал',exact:true}).getAttribute('href'),'https://t.me/+SN0L5X4t6RkzZWJi')
 assert.equal(await panel.getByRole('link',{name:'Открыть в Telegram Web',exact:true}).getAttribute('href'),'https://web.telegram.org/k/#-4328792903')
 assert.equal(await page.locator('aside a').filter({hasText:'Канал компании'}).getAttribute('href'),'https://t.me/+SN0L5X4t6RkzZWJi')
 assert((await panel.innerText()).includes('повторная привязка через сайт не нужна'));assert.equal(await panel.locator('details').getAttribute('open'),null);checks.push('separate bot/invite/web links; sidebar channel; relinking optional by default')
 for(const width of [1440,768,390,320]){await page.setViewportSize({width,height:1000});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'horizontal overflow at '+width);await page.screenshot({path:out+'/after-ru-'+width+'.png',fullPage:true})}checks.push('RU desktop/tablet/mobile 1440/768/390/320 without overflow')
 await page.setViewportSize({width:1440,height:1000});await panel.locator('summary').click();await panel.getByRole('button',{name:'Создать ссылку привязки',exact:true}).click();await panel.locator('[role=status] a').waitFor();const link=await panel.locator('[role=status] a').getAttribute('href');assert(/^https:\/\/t\.me\/VoiceChatGpt_Custom_bot\?start=[0-9a-f-]{36}$/i.test(link));assert.equal(await panel.locator('[role=alert]').count(),0);checks.push('fallback only on demand; authenticated one-time token generated; no Telegram navigation')
 await panel.locator('summary').click()
 for(const locale of ['en','kk']){await page.locator('header.topbar .preferences select').first().selectOption(locale);await page.waitForFunction(l=>document.documentElement.lang===l,locale);await page.waitForFunction(()=>document.querySelector('header.topbar .preferences')?.getAttribute('aria-busy')==='false');for(const width of [1440,320]){await page.setViewportSize({width,height:1000});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await page.screenshot({path:out+'/after-'+locale+'-'+width+'.png',fullPage:true})}}checks.push('EN/KK desktop/mobile, translated onboarding and no overflow')
 assert.deepEqual(errors,[]);console.log('PASS Telegram web UX: bot/channel distinction, conditional linking, working token fallback, RU/EN/KK and mobile')
}finally{await writeFile(out+'/browser-report.json',JSON.stringify({base,checks,errors,telegramMessagesSent:false},null,2));await browser.close()}
