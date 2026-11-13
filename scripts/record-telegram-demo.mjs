import assert from 'node:assert/strict'
import {mkdir,rename,writeFile} from 'node:fs/promises'
import {pathToFileURL} from 'node:url'
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE?pathToFileURL(process.env.PLAYWRIGHT_MODULE).href:'playwright')
const browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_EXECUTABLE_PATH||undefined,args:['--no-sandbox']})
const out='docs/evidence/demo-recording';await mkdir(out,{recursive:true})
const ctx=await browser.newContext({viewport:{width:1440,height:1000},recordVideo:{dir:out,size:{width:1440,height:1000}}}),page=await ctx.newPage(),video=page.video(),errors=[]
page.on('pageerror',e=>errors.push(e.message));const pause=()=>page.waitForTimeout(1000)
async function click(loc){await loc.scrollIntoViewIfNeeded();await page.locator('[data-demo-focus]').evaluateAll(es=>es.forEach(e=>{e.style.outline='';e.style.outlineOffset='';e.removeAttribute('data-demo-focus')}));await loc.evaluate(e=>{e.setAttribute('data-demo-focus','');e.style.outline='3px solid #c4a7ff';e.style.outlineOffset='3px'});await page.waitForTimeout(350);const done=page.waitForResponse(r=>r.url().endsWith('/action')&&r.request().method()==='POST');await loc.click();const response=await done;assert.equal(response.status(),200);await pause()}
async function send(text){await page.locator('#message').pressSequentially(text,{delay:15});await click(page.locator('form button'))}
async function role(r){await page.locator(`[data-role="${r}"]`).click();await pause()}
async function button(name){name=name.replace(/\p{Extended_Pictographic}|\uFE0F|\u200D/gu,'').trim();await click(page.locator('#thread').getByRole('button').filter({hasText:name}).last())}
async function open(){await click(page.locator('#thread .msg').last().locator('button[data-callback^="open:"]').last())}
try{
 await page.goto('http://127.0.0.1:3018');await pause();await click(page.locator('#new'));await click(page.locator('#voice'));await button('📂 Изменить категорию');await click(page.locator('#thread .msg').last().getByRole('button',{name:/Каталог/}));await button('✅ Подтвердить и отправить');
 const state=await (await page.request.get('http://127.0.0.1:3018/state')).json();assert(state.messages.some(m=>m.tg<0&&m.text.includes('Статус: Новое')))
 await role('manager');await click(page.locator('#list'));await open();await button('На рассмотрении');await button('Нужно уточнение');await send('В какой спецификации встречаются SYN-001 и SYN001?');
 await role('employee');await click(page.locator('#list'));await open();await button('Ответить');await send('В синтетической спецификации закупки, это один товар.');
 await role('manager');await click(page.locator('#list'));await open();await button('В работе');await send('Согласовать единый код с закупками.');await button('Реализовано');await send('Закреплён SYN-001; SYN001 сохранён как поисковый алиас.');
 await role('employee');await click(page.locator('#list'));await open();await button('Ознакомлен с решением');
 const final=await (await page.request.get('http://127.0.0.1:3018/state')).json();assert(final.messages.some(m=>m.text==='Ознакомление сохранено.'));assert(final.messages.some(m=>m.tg<0&&m.text.includes('Статус: Реализовано')));assert(final.messages.some(m=>m.tg===final.users.employee&&m.text.includes('Текущий статус: implemented')));assert.deepEqual(errors,[])
 await pause();await page.screenshot({path:out+'/demo-4-telegram-bot-e2e.png'});await ctx.close();await rename(await video.path(),out+'/demo-4-telegram-bot-e2e.webm');await writeFile(out+'/telegram-report.json',JSON.stringify({database:'real local PostgreSQL, transaction rollback',bot:'actual webhook, inbox, bot.ts, delivery.ts',adapters:['Telegram API','voice download','Whisper transcription','AI'],checks:['voice draft','explicit category and submit','real outbox channel card','manager clarification','author reply','work','decision','author notification','acknowledgment'],errors},null,2));console.log('PASS Telegram interactive E2E with real bot + SQL + outbox')
}finally{await browser.close()}
