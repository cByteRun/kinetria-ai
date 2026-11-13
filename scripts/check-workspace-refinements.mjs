import { pathToFileURL } from 'node:url'
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ? pathToFileURL(process.env.PLAYWRIGHT_MODULE).href : 'playwright')
import assert from 'node:assert/strict'
const base = process.env.P0_BASE_URL || 'http://localhost:3000'
const browser = await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_EXECUTABLE_PATH || undefined,args:['--no-sandbox']})
try {
const page = await browser.newPage()
await page.goto(base + '/login')
await page.locator('[data-account="admin"]').click()
await page.waitForURL('**/workspace/admin**')
for (const width of [1280,1366,1440,1920]) {
 await page.setViewportSize({width,height:1000})
 for (const locale of ['ru','en','kk']) {
 await page.locator('header.topbar .preferences select').first().selectOption(locale)
 await page.waitForFunction(l=>document.documentElement.lang===l,locale)
 await page.waitForFunction(()=>document.querySelector('header.topbar .preferences').getAttribute('aria-busy')==='false')
 for (const theme of ['light','dark']) {
 await page.evaluate(value=>document.documentElement.dataset.theme=value,theme)
 const boxes=await page.locator('.topbar').evaluate(el=>{
  const rect=e=>{const r=e.getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width}}
  return {header:rect(el), zones:[...el.children].map(rect), overflow:document.documentElement.scrollWidth>innerWidth, controls:[...el.querySelectorAll('.top-actions > *, .header-primary > :not(dialog)')].filter(e=>e.getBoundingClientRect().width).map(rect)}
 })
 console.log('PASS header',width,locale,theme)
 assert(Math.abs((boxes.zones[1].left+boxes.zones[1].right)/2-(boxes.header.left+boxes.header.right)/2)<1,'primary actions centered')
 assert(!boxes.overflow,'page overflow')
 for(let i=1;i<boxes.zones.length;i++) assert(boxes.zones[i-1].right<=boxes.zones[i].left+1,'zones overlap')
 assert(boxes.controls.every(r=>r.right<=boxes.header.right && r.left>=boxes.header.left),'controls outside header')
 }
 }
}
await page.screenshot({path:'/tmp/workspace-header.png'})
} finally {await browser.close()}
