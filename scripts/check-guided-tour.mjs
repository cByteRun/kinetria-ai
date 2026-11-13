import assert from 'node:assert/strict'
import { pathToFileURL } from 'node:url'
import { mkdir, writeFile } from 'node:fs/promises'
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ? pathToFileURL(process.env.PLAYWRIGHT_MODULE).href : 'playwright')
const browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH || undefined, args: ['--no-sandbox'] })
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } })
const page = await context.newPage()
const errors = [], checks = [], writes = []
const base = process.env.P0_BASE_URL || 'http://localhost:3000'
const evidence = 'docs/evidence/guided-tour'
const pass = message => { checks.push(message); console.log('PASS', message) }
page.on('pageerror', e => errors.push(e.message))
page.on('request', r => { if (r.method() === 'POST') writes.push(r.url()) })
const tour = page.locator('.tour-dialog')
const button = text => tour.getByRole('button', { name: text, exact: true })
async function advance(step, clarification = false) {
  if (step === 0) await button('Начать как Сотрудник →').click()
  if (step === 1) await button('Показать пример AI-черновика →').click()
  if (step === 2) await button('Зарегистрировать обращение').click()
  if (step === 3) await button('Перейти к роли Руководителя →').click()
  if (step === 4) {
    await tour.getByLabel('Ответственный', { exact: true }).selectOption('Дмитрий Орлов')
    if (clarification) {
      await button('Запросить уточнение (необязательно)').click()
      await tour.getByLabel('Ответ на уточнение').fill('В проекте MX-10, в заявке закупок MX10.')
    }
    await button('Назначить и перейти к Ответственному →').click()
  }
  if (step === 5) {
    await button('Взять в работу').click()
    await button('Заполнить пример решения').click()
    await button('Сохранить решение · Решено').click()
    await button('Я ознакомилась с решением').click()
    await button('Перейти к роли Администратора →').click()
  }
  if (step === 6) {
    await button('Аналитика').click()
    await button('Повторяющиеся темы').click()
    await button('Показать пример ответа Qvin').click()
    await tour.getByText('Подготовленный пример ответа', { exact: true }).waitFor()
    await button('К Telegram и инструкциям →').click()
  }
}
try {
  await mkdir(evidence, { recursive: true })
  await page.goto(base + '/login')
  await tour.waitFor()
  await button('Завершить тур').click()
  assert.equal(await page.evaluate(() => localStorage.getItem('idearoute_tour_completed')), 'true')
  await page.reload()
  await page.locator('.tour-trigger').waitFor()
  assert.equal(await tour.count(), 0)
  pass('first visit auto-start; close persists; reload does not reopen')
  await page.locator('[data-account="employee"]').click()
  await page.waitForURL('**/workspace/employee**')
  const url = page.url()
  const postCount = writes.length
  for (const width of [320, 390, 768, 1024, 1280, 1440]) {
    await page.setViewportSize({ width, height: 900 })
    if (!await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)) {
      console.log(await page.locator('.global-header').evaluate(el => Array.from(el.querySelectorAll('*')).filter(e => e.getBoundingClientRect().width).map(e => ({ c: e.className, x: e.getBoundingClientRect().x, w: e.getBoundingClientRect().width, display: getComputedStyle(e).display }))))
      await page.screenshot({ path: '/tmp/tour-header-overflow.png' })
    }
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `header overflow at ${width}`)
    const controls = await page.locator('.global-header').evaluate(el => Array.from(el.querySelectorAll('.tour-trigger,.command-trigger,.preferences select,.theme-toggle,.shell-profile summary')).filter(e => e.getBoundingClientRect().width).map(e => { const r = e.getBoundingClientRect(); return { left: r.left, right: r.right, top: r.top, bottom: r.bottom } }))
    for (const a of controls) assert(a.left >= 0 && a.right <= width, `control outside viewport ${width}`)
    for (let i = 0; i < controls.length; i++) for (let j = i + 1; j < controls.length; j++) {
      const a = controls[i], b = controls[j]
      assert(!(a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom), `header overlap ${width}`)
    }
  }
  pass('header controls fit without overlap at 320/390/768/1024/1280/1440')
  for (const width of [1440, 320]) {
    await page.setViewportSize({ width, height: 900 })
    await page.evaluate(width => { document.documentElement.dataset.theme = width === 320 ? 'dark' : 'light' }, width)
    await page.locator('.tour-trigger').click()
    for (let step = 0; step < 7; step++) {
      await tour.locator('.tour-role').first().filter({ hasText: `${step + 1} / 8` }).waitFor()
      assert(await tour.evaluate(el => el.scrollWidth <= innerWidth), `tour overflow step ${step}, width ${width}`)
      if (width === 320 && step === 1) {
        await button('К выделенному действию ↓').click()
        await page.waitForFunction(() => {
          const r = document.querySelector('[data-tour="compose"] button[type="submit"]').getBoundingClientRect()
          return r.top >= 0 && r.bottom <= innerHeight
        })
        assert(await tour.locator('.tour-close').evaluate(el => { const r = el.getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight }))
      }
      await page.screenshot({ path: `${evidence}/${width}-step-${step + 1}.png` })
      await advance(step, width === 320)
    }
    assert.equal(await tour.locator('a[target="_blank"]').count(), 3)
    await button('Завершить тур').last().click()
    await page.locator('.tour-trigger:focus').waitFor()
    assert.equal(page.url(), url)
    assert.equal(writes.length, postCount)
    pass(`full 8-step lifecycle ${width}px, clarification=${width === 320}; no writes or auth/route changes; focus restored`)
  }
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.locator('.sidebar [data-tour="reset"]').click()
  await tour.waitFor()
  await page.keyboard.press('Escape')
  assert.equal(await tour.count(), 0)
  pass('sidebar restart and Escape cleanup')
  for (let target = 0; target < 8; target++) {
    await page.locator('.tour-trigger').click()
    for (let step = 0; step < target; step++) await advance(step)
    await button('Завершить тур').first().click()
    assert.equal(await tour.count(), 0)
    assert.notEqual(await page.evaluate(() => document.body.style.overflow), 'hidden')
  }
  pass('close at every step removes overlay and restores page scroll')
  for (const [locale, heading] of [['en', 'From message to result in 3 minutes'], ['kk', 'Хабарламадан нәтижеге дейін 3 минутта']]) {
    await context.addCookies([{ name: 'kinetria_locale', value: locale, url: base }])
    await page.reload()
    await page.locator('.tour-trigger').click()
    await tour.getByRole('heading', { name: heading }).waitFor()
    await tour.locator('.tour-close').click()
  }
  pass('English and Kazakh tour catalogs render without missing messages')
  await context.addCookies([{ name: 'kinetria_locale', value: 'ru', url: base }])
  await page.setViewportSize({ width: 320, height: 900 })
  for (const path of ['/', '/login', '/feedback']) {
    await page.goto(base + path)
    await page.locator('.tour-trigger').waitFor()
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `public header overflow ${path}`)
  }
  pass('shared public header fits at 320px on landing/login/feedback')
  // Browser policy may deny localStorage; cookie completion must still work.
  const fallback = await browser.newContext()
  await fallback.addInitScript(() => Object.defineProperty(window, 'localStorage', { get() { throw new DOMException('Denied', 'SecurityError') } }))
  const f = await fallback.newPage()
  await f.goto(base + '/login')
  await f.locator('.tour-dialog').waitFor()
  await f.getByRole('button', { name: 'Завершить тур', exact: true }).click()
  await f.reload()
  await f.locator('.tour-trigger').waitFor()
  assert.equal(await f.locator('.tour-dialog').count(), 0)
  await fallback.close()
  pass('cookie fallback when localStorage is denied')
  assert.deepEqual(errors, [])
} finally {
  await writeFile(`${evidence}/results.json`, JSON.stringify({ checks, errors }, null, 2))
  await browser.close()
}
