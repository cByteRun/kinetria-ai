import assert from 'node:assert/strict'
import { pathToFileURL } from 'node:url'
import { mkdir } from 'node:fs/promises'
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ? pathToFileURL(process.env.PLAYWRIGHT_MODULE).href : 'playwright')
const browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH || undefined, args: ['--no-sandbox'] })
const base = process.env.P0_BASE_URL || 'http://localhost:3016'
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
await context.addCookies([{ name: 'idearoute_tour_completed', value: 'true', url: base }])
const page = await context.newPage()
const errors = [], writes = []
page.on('pageerror', error => errors.push(error.message))
page.on('request', request => { if (request.method() === 'POST') writes.push(request.url()) })
const tour = page.locator('.tour-context-dialog[open]')
try {
 await mkdir('docs/evidence/guided-tour', { recursive: true })
 for (const role of ['admin', 'manager', 'employee', 'handler']) {
  await page.goto(base + '/login')
  await page.locator(`[data-account="${role}"]`).click()
  await page.waitForURL(`**/workspace/${role}**`)
  const trigger = page.locator('.tour-trigger')
  assert.match(await trigger.getAttribute('class'), new RegExp(`tour-trigger-${role}`))
  assert.equal(await trigger.locator('.tour-personal-badge').textContent(), 'Индв.')
  for (const width of [1440, 320]) {
   await page.setViewportSize({ width, height: 900 })
   await page.goto(base + `/workspace/${role}?view=registry`)
   await trigger.click()
   await tour.waitFor()
   await page.waitForURL(`**/workspace/${role}?view=overview`)
   const before = writes.length
   for (let step = 0; step < 6; step++) {
    await tour.locator('.tour-role').filter({ hasText: `${step + 1} / 6` }).waitFor()
    await tour.locator('.tour-shade > rect[stroke]').waitFor()
    assert(await tour.locator('.tour-context-coach').evaluate(el => { const r = el.getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth + 1 && r.top >= 0 && r.bottom <= innerHeight + 1 }))
    if (step === 3) await page.screenshot({ path: `docs/evidence/guided-tour/${role}-${width}-route.png` })
    if (step === 3 && width === 320) {
     const scroll = await page.evaluate(() => scrollY)
     await page.mouse.move(4, 250)
     await page.mouse.wheel(0, 160)
     await page.waitForFunction(previous => scrollY > previous, scroll)
    }
    if (step === 5) assert.match(await tour.textContent(), /Остальные функции вы можете изучить позже/)
    await tour.getByRole('button', { name: step === 5 ? 'Готово' : 'Далее', exact: true }).click()
   }
   assert.equal(await tour.count(), 0)
   assert.equal(writes.length, before)
   assert(await trigger.evaluate(el => document.activeElement === el))
   console.log(`PASS ${role} ${width}: personal button, Overview navigation, 6 live steps, no writes, focus return`)
  }
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto(base + `/workspace/${role}?view=registry&filter=open`)
  await page.locator('.sidebar [data-tour="reset"]').click()
  await tour.waitFor()
  await page.waitForURL(`**/workspace/${role}?view=overview`)
  await page.keyboard.press('Escape')
  assert.equal(await tour.count(), 0)
  await page.setViewportSize({ width: 320, height: 900 })
  await page.locator('.mobile-more').click()
  await page.locator('.mobile-nav-sheet [data-tour="reset"]').click()
  await tour.waitFor()
  assert.equal(await page.locator('.mobile-nav-sheet[open]').count(), 0)
  await page.keyboard.press('Escape')
  assert.equal(await page.locator('dialog[open]').count(), 0)
 }
 // A removed widget must be skipped, and an empty focus queue must remain useful.
 await page.goto(base + '/workspace/handler?view=overview')
 await page.locator('.tour-trigger').click()
 await tour.waitFor()
 await page.locator('[data-tour="overview-pulse"]').evaluate(el => el.remove())
 await tour.getByRole('button', { name: 'Далее', exact: true }).click()
 await tour.locator('.tour-role').filter({ hasText: '3 / 6' }).waitFor()
 await page.locator('[data-tour="overview-focus"]').evaluate(el => el.setAttribute('data-tour-empty', 'true'))
 await tour.getByRole('button', { name: 'Далее', exact: true }).click()
 await tour.getByRole('button', { name: 'Далее', exact: true }).click()
 assert.match(await tour.textContent(), /Сейчас обращений, требующих внимания, нет/)
 await page.keyboard.press('Escape')
 for (const locale of ['en', 'kk']) {
  await context.addCookies([{ name: 'kinetria_locale', value: locale, url: base }])
  await page.reload()
  await page.locator('.tour-trigger').click()
  await tour.waitFor()
  assert(!/context\.|MISSING_MESSAGE/.test(await tour.textContent()))
  await page.keyboard.press('Escape')
 }
 assert.deepEqual(errors, [])
 console.log('PASS missing target skip, empty queue, sidebar restart, Escape, EN/KK, no runtime errors')
} finally { await browser.close() }
