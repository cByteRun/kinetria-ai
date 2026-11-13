import assert from 'node:assert/strict'
import { pathToFileURL } from 'node:url'
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ? pathToFileURL(process.env.PLAYWRIGHT_MODULE).href : 'playwright')
const browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH || undefined, args: ['--no-sandbox'] })
const base = process.env.P0_BASE_URL || 'http://localhost:3000'
const errors = []
try {
  for (const locale of ['ru', 'en', 'kk']) {
    const context = await browser.newContext()
    await context.addCookies([{ name: 'kinetria_locale', value: locale, url: base }])
    const page = await context.newPage()
    page.on('pageerror', error => errors.push(error.message))
    for (const width of [320, 1440]) {
      await page.setViewportSize({ width, height: 900 })
      for (const path of ['/', '/login']) {
        await page.goto(base + path)
        const tour = page.locator('.tour-dialog')
        if (!await tour.count()) await page.locator('.tour-trigger').click()
        await tour.waitFor()
        const url = page.url()
        const posts = []
        const track = request => { if (request.method() === 'POST') posts.push(request.url()) }
        page.on('request', track)
        const heading = tour.getByRole('heading')
        const first = await heading.textContent()
        for (let step = 0; step < 8; step++) {
          await tour.locator('.tour-role').filter({ hasText: `${step + 1} / 8` }).waitFor()
          assert(await tour.evaluate(el => el.scrollWidth <= innerWidth))
          if (step === 1) {
            await tour.locator('.tour-context-actions button').first().click()
            assert.equal(await heading.textContent(), first)
            await tour.locator('.tour-context-actions button').last().click()
          }
          if (step === 5 || step === 6) {
            const link = tour.locator('a[target="_blank"]')
            assert.equal(await link.count(), 1)
            assert.match(await link.getAttribute('href'), /^https:\/\/t.me\//)
          }
          if (step === 7) {
            assert.equal(await tour.locator('a[target="_blank"]').count(), 2)
            assert.equal(await tour.locator('a[href="/login"]').count(), 1)
          }
          await tour.locator('.tour-context-actions button').last().click()
        }
        assert.equal(await tour.count(), 0)
        assert.equal(page.url(), url)
        assert.deepEqual(posts, [])
        page.off('request', track)
        assert.equal(await page.evaluate(() => localStorage.getItem('idearoute_tour_completed')), 'true')
        await page.reload()
        await page.locator('.tour-trigger').waitFor()
        assert.equal(await tour.count(), 0)
        await page.locator('.tour-trigger').click()
        await page.keyboard.press('Escape')
        assert.equal(await tour.count(), 0)
        assert.notEqual(await page.evaluate(() => document.body.style.overflow), 'hidden')
        console.log(`PASS public tour: ${locale}, ${width}px, ${path}; 8 steps, back, links, persistence, Escape, no writes`)
      }
    }
    await context.close()
  }
  const context = await browser.newContext({ viewport: { width: 320, height: 900 } })
  await context.addCookies([{ name: 'kinetria_locale', value: 'ru', url: base }])
  const page = await context.newPage()
  page.on('pageerror', error => errors.push(error.message))
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
  await page.goto(base + '/login')
  await button('Попробовать сквозной сценарий прямо сейчас').click()
  await tour.getByRole('heading', { name: 'От сообщения к результату за 3 минуты' }).waitFor()
  const posts = []
  page.on('request', request => { if (request.method() === 'POST') posts.push(request.url()) })
  const url = page.url()
  for (let step = 0; step < 7; step++) {
    await tour.locator('.tour-role').first().filter({ hasText: `${step + 1} / 8` }).waitFor()
    assert(await tour.evaluate(el => el.scrollWidth <= innerWidth))
    await advance(step, true)
  }
  await button('Познакомиться с кабинетами').click()
  await tour.getByRole('heading', { name: 'Попробуйте IdeaRoute за 3 минуты' }).waitFor()
  assert.equal(page.url(), url)
  assert.deepEqual(posts, [])
  await page.keyboard.press('Escape')
  assert.notEqual(await page.evaluate(() => document.body.style.overflow), 'hidden')
  await context.close()
  console.log('PASS optional full workflow: clarification, resolution, acknowledgment, return to overview; no writes or route changes')
  assert.deepEqual(errors, [])
} finally { await browser.close() }
