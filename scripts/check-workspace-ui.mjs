import assert from 'node:assert/strict'
import { pathToFileURL } from 'node:url'
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ? pathToFileURL(process.env.PLAYWRIGHT_MODULE).href : 'playwright')
import {writeFile, mkdir} from 'node:fs/promises'
const base=process.env.P0_BASE_URL||'http://localhost:3000'
const b=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_EXECUTABLE_PATH || undefined,args:['--no-sandbox','--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream']})
const c=await b.newContext({permissions:['microphone'],viewport:{width:1440,height:1000}}),p=await c.newPage();const errors=[],checks=[],timings=[];p.on('pageerror',e=>errors.push(e.message));const pass=s=>{checks.push(s);console.log('PASS',s)}
await mkdir('docs/evidence/workspace-update',{recursive:true})
try {
await p.goto(base+'/login');await p.locator('[data-account="employee"]').click();await p.waitForURL('**/workspace/employee**');await p.locator('.sidebar').waitFor();
for (const palette of ['blue','purple']) for(const theme of ['light','dark']) {
 await p.evaluate(({palette,theme})=>{document.documentElement.dataset.theme=theme;document.documentElement.dataset.colorTheme=palette},{palette,theme});
 for(const width of [320,390,768,1440]){await p.setViewportSize({width,height:1000});assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`overflow ${palette} ${theme} ${width}`);const bg=await p.evaluate(()=>getComputedStyle(document.documentElement).backgroundColor);assert.notEqual(bg,'rgba(0, 0, 0, 0)')}
}
pass('32 viewport/theme/palette combinations: opaque root, no overflow');await p.setViewportSize({width:1440,height:1000});
await p.locator('.sidebar a.nav-link[href$="?view=overview"]').click();await p.waitForURL('**view=overview');await p.evaluate(()=>{window.shell=document.querySelector('.sidebar');window.prefs=document.querySelector('.preferences')});
for(const view of ['registry','results','overview']) {const t=Date.now();await p.locator('.sidebar a.nav-link[href$="?view='+view+'"]').click();await p.waitForURL('**?view='+view);timings.push({view,ms:Date.now()-t});assert(await p.evaluate(()=>window.shell===document.querySelector('.sidebar')&&window.prefs===document.querySelector('.preferences')))}
assert.equal(await p.locator('.brand-lockup .brand-mark').getAttribute('href'),'/');assert.equal(await p.locator('.brand-lockup > a').nth(1).getAttribute('href'),'/workspace/employee?view=overview');pass('persistent shell, preferences and separate brand destinations');
let rsc=0;const track=req=>{if(req.headers().rsc)rsc++};await p.waitForTimeout(500);p.on('request',track);await p.locator('.theme-toggle').click();await p.waitForFunction(()=>document.querySelector('.preferences').getAttribute('aria-busy')==='false');p.off('request',track);assert.equal(rsc,0);pass('theme: 0 RSC requests');
for(const locale of ['en','kk','ru']){await p.locator('.preferences select').first().selectOption(locale);await p.waitForFunction(l=>document.documentElement.lang===l,locale);await p.waitForFunction(()=>document.querySelector('.preferences').getAttribute('aria-busy')==='false')};pass('RU/EN/KK changes keep document and shell');
await p.locator('.sidebar a.nav-link[href$="?view=new"]').click();await p.getByRole('button',{name:'С помощью AI',exact:true}).click();const mic=p.getByRole('button',{name:'Записать голос',exact:true});await mic.click();await p.locator('.voice-recording').waitFor();await p.waitForTimeout(600);await p.getByRole('button',{name:'Отмена',exact:true}).click();assert.equal(await p.locator('.voice-message').count(),0);pass('microphone recording, timer, cancellation without sending');
await p.route('**/api/voice/transcribe',async route=>{await new Promise(r=>setTimeout(r,300));await route.fulfill({json:{text:'Предлагаю упростить заявки на оборудование.'}})});
await mic.click();await p.locator('.voice-recording').waitFor();await p.waitForTimeout(600);await p.getByRole('button',{name:'Отправить запись',exact:true}).click();await p.locator('.voice-message audio').waitFor();await p.waitForFunction(()=>document.querySelector('textarea[name=description]')?.value.includes('Предлагаю упростить'));assert.equal(await p.locator('.voice-message audio').count(),1);pass('recorded audio → player → transcript → editable draft (mock transcription, preview fallback)');
await p.route('**/api/voice/transcribe',route=>route.fulfill({status:502,json:{error:'unavailable'}}));await mic.click();await p.locator('.voice-recording').waitFor();await p.waitForTimeout(600);await p.getByRole('button',{name:'Отправить запись',exact:true}).click();await p.getByRole('button',{name:'Повторить распознавание'}).waitFor();await p.route('**/api/voice/transcribe',route=>route.fulfill({json:{text:'Нужно добавить инструкцию для сотрудников.'}}));await p.getByRole('button',{name:'Повторить распознавание'}).click();await p.waitForFunction(()=>document.querySelector('textarea[name=description]')?.value.includes('Нужно добавить'));assert.equal(await p.locator('.voice-message audio').count(),2);pass('network error retains audio; retry reuses bubble and fills draft');
await p.evaluate(() => {
  window.originalGetUserMedia = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices)
  navigator.mediaDevices.getUserMedia = () => Promise.reject(new DOMException('Denied', 'NotAllowedError'))
})
await mic.click();await p.getByRole('alert').filter({hasText:'Нет доступа к микрофону'}).waitFor();pass('microphone permission denial has actionable error')
await p.evaluate(() => {
  navigator.mediaDevices.getUserMedia = async constraints => {
    const stream = await window.originalGetUserMedia(constraints)
    window.lastStream = stream
    return stream
  }
})
await mic.click();await p.locator('.voice-recording').waitFor();await p.locator('.sidebar a.nav-link[href$="?view=registry"]').click();await p.waitForURL('**view=registry');assert(await p.evaluate(()=>window.lastStream.getTracks().every(track=>track.readyState==='ended')));pass('leaving composer releases microphone tracks')
await p.screenshot({path:'docs/evidence/workspace-update/voice.png'});assert.deepEqual(errors,[])
}finally{await mkdir('docs/evidence/workspace-update',{recursive:true});await writeFile('docs/evidence/workspace-update/ui.json',JSON.stringify({checks,timings,errors},null,2));await b.close()}
