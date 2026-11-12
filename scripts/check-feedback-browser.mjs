import assert from 'node:assert/strict'
import { pathToFileURL } from 'node:url'
import { mkdir, writeFile } from 'node:fs/promises'
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ? pathToFileURL(process.env.PLAYWRIGHT_MODULE).href : 'playwright')
const base = process.env.P0_BASE_URL || 'http://localhost:3000'
const out = 'docs/evidence/closed-loop-review'
await mkdir(out, { recursive: true })
const browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_EXECUTABLE_PATH ? {executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH} : {}), args: ['--no-sandbox'] })
const report = {checks: [], errors: [], timings: [], screenshots: []}
async function check(name, fn) { await fn(); report.checks.push(name); console.log('PASS', name) }
async function capture(page, name, fullPage = false) { await page.screenshot({path: `${out}/${name}.png`, fullPage}); report.screenshots.push(name + '.png') }
try {
  for (const [account, role] of [['employee', 'employee'], ['manager-it', 'manager'], ['handler-catalog', 'handler'], ['admin', 'admin']]) {
    const context = await browser.newContext({ viewport: {width:1440,height:1000} })
    await context.addCookies([{name:'kinetria_theme', value:'light', url:base}])
    const page = await context.newPage()
    page.on('pageerror', e => report.errors.push(e.message))
    page.on('console', msg => {if(msg.type()==='error') console.log('CONSOLE', msg.text().slice(0,1800))})
    await page.goto(base + '/login')
    const button = page.locator(`button[data-account="${account}"]`)
    assert(await button.count())
    let started = Date.now()
    await button.click()
    await page.waitForURL(`**/workspace/${role}?view=*`, {timeout:30000})
    await page.locator('main h1').waitFor()
    report.timings.push({role, action:'login', ms:Date.now()-started})
    await check(`${role}: authenticated without reload`, async()=> assert(page.url().includes('/workspace/' + role)))
    for (const view of ['registry', 'results', 'notifications']) {
      await page.goto(`${base}/workspace/${role}?view=${view}`)
      await page.locator('main h1').waitFor()
      for (const width of [320,390,768,1440]) {
        await page.setViewportSize({width,height:900})
        await check(`${role}/${view}: no overflow at ${width}`,async()=>assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)))
        if(width<=390) await check(`${role}/${view}: bottom navigation fixed at ${width}`,async()=>{
          await page.evaluate(()=>window.scrollTo(0,document.body.scrollHeight))
          const rect=await page.locator('.mobile-tabs').boundingBox()
          assert(Math.abs(rect.y+rect.height-900)<2)
          assert.equal(await page.locator('.mobile-tabs').evaluate(e=>getComputedStyle(e).position),'fixed')
          const links=page.locator('.mobile-tabs a');assert((await links.count())<=5)
          for(const link of await links.all()) assert((await link.boundingBox()).width>=44)
        })
      }
      if(view==='registry') {
        if(role==='employee') {
          await page.goto(`${base}/workspace/${role}?view=registry&id=39c6fa20-1040-473a-9923-64a20f69b159`)
        } else {
          const list = page.getByRole('button',{name:'Список',exact:true})
          if(await list.count())await list.click()
          await page.locator('.case-title').first().click()
        }
        await page.locator('.crm-detail-history').waitFor()
        await check(`${role}: history stays in content column`,async()=>assert.equal(await page.locator('.crm-detail-content > .crm-detail-history').count(),1))
        for(const width of [320,390,768,1440]) {await page.setViewportSize({width,height:1000});await check(`${role}/detail: no overflow at ${width}`,async()=>assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)))}
        await capture(page,`after-${role}-detail-light`)
        await page.setViewportSize({width:390,height:844});await capture(page,`after-${role}-detail-mobile`)
      }
      if(view==='notifications' && role==='employee') {
        await page.getByRole('button',{name:/Нужно действие/}).click()
        for(const card of await page.locator('.feedback-notification').all()) assert.match(await card.innerText(),/Нужен ваш ответ/)
        await page.getByRole('button',{name:/Результаты/ ,exact:false}).filter({has:page.locator('span')}).click()
        for(const card of await page.locator('.feedback-notification').all()) assert.match(await card.innerText(),/Результат готов|Автор ознакомился/)
        await page.getByRole('button',{name:/Все \d/}).click()
      }
      await page.setViewportSize({width:390,height:844});await page.evaluate(()=>window.scrollTo(0,0));await capture(page,`after-${role}-${view}-mobile`)
      await page.getByRole('button',{name:'Включить тёмную тему',exact:true}).click()
      await page.waitForFunction(()=>document.documentElement.dataset.theme==='dark')
      await page.waitForFunction(() => [...document.querySelectorAll('.theme-toggle,.ir-mobile-toggle')].filter(e => e.getClientRects().length).every(e => ['rgb(32, 30, 43)', 'rgb(40, 36, 53)'].includes(getComputedStyle(e).backgroundColor)))
      await check(`${role}/${view}: dark surfaces and readable text`,async()=>{
        for (const control of await page.locator('.theme-toggle,.ir-mobile-toggle').all())
          if (await control.isVisible()) assert.notEqual(await control.evaluate(e => getComputedStyle(e).backgroundColor), 'rgb(255, 255, 255)')
        const selector=view==='results'?'.result-item':view==='notifications'?'.feedback-notification':'.card'
        const el=page.locator(selector).first();if(await el.count()) {
          const styles=await el.evaluate(e=>({background:getComputedStyle(e).backgroundColor,color:getComputedStyle(e).color}))
          assert.notEqual(styles.background,'rgb(255, 255, 255)');assert.notEqual(styles.color,'rgb(40, 38, 51)')
        }
      })
      await capture(page,`after-${role}-${view}-dark-mobile`)
      await page.getByRole('button',{name:'Включить светлую тему',exact:true}).click()
      await page.waitForFunction(()=>document.documentElement.dataset.theme==='light')
    }
    await page.setViewportSize({width:1440,height:1000})
    started=Date.now()
    await page.getByRole('button',{name:'Выйти',exact:true}).click()
    await page.waitForURL('**/login',{timeout:15000})
    report.timings.push({role,action:'logout',ms:Date.now()-started})
    await check(`${role}: logout clears session and protected URLs redirect`,async()=>{
      const cookies=await context.cookies();assert(!cookies.some(c=>c.name.includes('auth-token')&&c.value))
      await page.goto(`${base}/workspace/${role}`);assert(new URL(page.url()).pathname==='/login')
      await page.reload();assert(new URL(page.url()).pathname==='/login')
    })
    await context.close()
  }
  assert.deepEqual(report.errors,[])
  report.status='passed'
} catch(e) {report.status='failed';report.failure=e.stack;process.exitCode=1;console.error(e);for(const context of browser.contexts())for(const page of context.pages())await capture(page,'failure')}
finally {await writeFile(out+'/report.json',JSON.stringify(report,null,2));await browser.close()}
