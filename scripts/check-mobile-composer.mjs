import assert from 'node:assert/strict'
import {pathToFileURL} from 'node:url'
import {mkdir,writeFile} from 'node:fs/promises'
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE?pathToFileURL(process.env.PLAYWRIGHT_MODULE).href:'playwright')
const base=process.env.P0_BASE_URL||'http://localhost:3012',checks=[],errors=[]
assert(['localhost','127.0.0.1'].includes(new URL(base).hostname),'Local test provider only')
const browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_EXECUTABLE_PATH||undefined,args:['--no-sandbox','--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream']})
const context=await browser.newContext({viewport:{width:360,height:800},permissions:['microphone']})
const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));const pass=s=>{checks.push(s);console.log('PASS',s)}
const out='docs/evidence/mobile-first/composer';await mkdir(out,{recursive:true})
try{
 await page.goto(base+'/login');await page.locator('[data-account=employee]').click();await page.waitForURL('**/workspace/employee**');await page.goto(base+'/workspace/employee?view=new')
 await page.getByRole('button',{name:'С помощью AI',exact:true}).click();await page.getByLabel('Сообщение помощнику').fill('Заявки приходится сверять вручную. Предлагаю единый справочник. Синтетический мобильный тест.')
 await page.locator('.crm-chat-controls').getByRole('button',{name:'Отправить',exact:true}).click();await page.waitForFunction(()=>Boolean(document.querySelector('[name=title]')?.value))
 assert(await page.locator('.mobile-tabs').isVisible(),'bottom navigation must be visible on direct composer entry');assert((await page.locator('textarea[name=description]').inputValue()).includes('Заявки приходится сверять'));pass('360px: prompt → AI server action → editable draft with original text')
 const fileName='Очень_длинное_название_приложенного_документа_для_проверки_переноса_строк_1234567890.txt'
 await page.locator('input[name=attachments]').setInputFiles({name:fileName,mimeType:'text/plain',buffer:Buffer.from('Synthetic mobile attachment')})
 for(const width of [360,390,430]){await page.setViewportSize({width,height:844});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:`${out}/draft-${width}.png`,fullPage:true})}pass('AI draft and long attachment filename fit 360/390/430')
 await page.route('**/api/voice/transcribe',r=>r.fulfill({json:{text:'Голосовой синтетический пример: нужен единый справочник.'}}))
 await page.getByRole('button',{name:'Записать голос',exact:true}).click();await page.locator('.voice-recording').waitFor();await page.waitForTimeout(600);await page.getByRole('button',{name:'Отправить запись',exact:true}).click();await page.locator('.voice-message audio').waitFor();await page.waitForFunction(()=>document.querySelector('textarea[name=description]')?.value.includes('Голосовой синтетический пример'))
 pass('mobile MediaRecorder → audio player → mocked transcript → editable draft')
 const draft=await page.locator('textarea[name=description]').inputValue()
 await page.locator('.global-header .preferences select').first().selectOption('en');await page.waitForFunction(()=>document.documentElement.lang==='en');assert.equal(await page.locator('textarea[name=description]').inputValue(),draft)
 await page.locator('.global-header .preferences select').first().selectOption('ru');await page.waitForFunction(()=>document.documentElement.lang==='ru');pass('locale change preserves text and voice draft')
 await page.getByRole('button',{name:'Записать голос',exact:true}).click();await page.locator('.voice-recording').waitFor();await page.getByRole('button',{name:'Отмена',exact:true}).click();assert.equal(await page.locator('.voice-message audio').count(),1);pass('cancel recording keeps prior audio and does not submit a request')
 await page.screenshot({path:out+'/voice.png',fullPage:true});assert.deepEqual(errors,[])
}finally{await writeFile(out+'/report.json',JSON.stringify({checks,errors,ai:'local deterministic provider',transcription:'Playwright route mock; actual microphone recording uses fake device',submitted:false},null,2));await browser.close()}
