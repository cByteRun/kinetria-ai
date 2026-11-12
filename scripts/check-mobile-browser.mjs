import { pathToFileURL } from 'node:url'
const { chromium } = await import(
  process.env.PLAYWRIGHT_MODULE
    ? pathToFileURL(process.env.PLAYWRIGHT_MODULE).href
    : 'playwright'
)
import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
const base = process.env.P0_BASE_URL || 'http://localhost:3000'
const out = 'docs/evidence/mobile-review'
await mkdir(out, { recursive: true })
const browser = await chromium.launch({
  headless: true,
  ...(process.env.PLAYWRIGHT_EXECUTABLE_PATH
    ? { executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH }
    : {}),
  args: ['--no-sandbox'],
})
const report = { checks: [], errors: [], screenshots: [] }
async function check(name, fn) {
  await fn()
  report.checks.push(name)
  console.log('PASS', name)
}
async function login(account, role) {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
  })
  await context.addCookies([
    { name: 'kinetria_theme', value: 'light', url: base },
  ])
  const page = await context.newPage()
  page.on('pageerror', (e) => report.errors.push(e.message))
  await page.goto(base + '/login')
  if (account === 'client') {
    assert(
      process.env.KINETRIA_DEMO_PASSWORD,
      'Client login needs KINETRIA_DEMO_PASSWORD',
    )
    await page
      .locator('input[name="email"]')
      .fill('client@kinetria.example')
    await page
      .locator('input[name="password"]')
      .fill(process.env.KINETRIA_DEMO_PASSWORD)
    await page
      .getByRole('button', {
        name: 'Войти в рабочее пространство',
        exact: true,
      })
      .click()
  } else
    await page
      .locator(`button[data-account="${account}"]`)
      .click()
  await page.waitForURL('**/workspace/' + role + '?view=*', { timeout: 60000 })
  return page
}
try {
  for (const [account, role] of [
    ['employee', 'employee'],
    ['manager-it', 'manager'],
    ['handler-catalog', 'handler'],
    ['admin', 'admin'],
    ['client', 'client'],
  ]) {
    const page = await login(account, role)
    const views =
      role === 'client'
        ? ['overview']
        : [
            'overview',
            'registry',
            'results',
            'notifications',
            ...(role === 'employee' ? ['new'] : ['analytics', 'insights']),
            ...(role === 'admin' ? ['categories', 'routing'] : []),
          ]
    for (const view of views) {
      await page.goto(`${base}/workspace/${role}?view=${view}`)
      await page.locator('main h1,main h2').first().waitFor()
      for (const width of [320, 390, 768, 1440]) {
        await page.setViewportSize({ width, height: 900 })
        await check(`${role}/${view} width ${width}`, async () => {
          const overflow = await page.evaluate(() => ({
            page: document.documentElement.scrollWidth,
            screen: innerWidth,
            offenders: [...document.querySelectorAll('main *')]
              .filter(
                (el) => el.getBoundingClientRect().right > innerWidth + 1,
              )
              .slice(0, 5)
              .map((el) => el.className),
          }))
          assert(
            overflow.page <= overflow.screen,
            JSON.stringify(overflow),
          )
        })
      }
      await page.setViewportSize({ width: 390, height: 844 })
      if (['overview', 'registry', 'new', 'insights'].includes(view)) {
        const file = `${role}-${view}-light.png`
        await page.screenshot({ path: out + '/' + file, fullPage: true })
        report.screenshots.push(file)
      }
      if (view === 'registry' && role !== 'employee') {
        const group = page.locator('.registry-group').first()
        if (await group.count()) {
          await group.locator('summary').click()
          assert((await group.locator('.case-title').count()) > 1)
          await page.screenshot({
            path: out + '/' + role + '-group-open.png',
            fullPage: true,
          })
        }
      }
    }
    await check(`${role}: theme persists`, async () => {
      await page
        .getByRole('button', { name: 'Включить тёмную тему', exact: true })
        .click()
      await page.waitForFunction(
        () => document.documentElement.dataset.theme === 'dark',
      )
      assert.equal(
        await page
          .locator('.ir-app')
          .evaluate((el) => getComputedStyle(el).colorScheme),
        'dark',
      )
      await page.reload()
      assert.equal(
        await page.locator('html').getAttribute('data-theme'),
        'dark',
      )
      await page.screenshot({
        path: out + '/' + role + '-dark.png',
        fullPage: true,
      })
    })
    if (role === 'employee' || role === 'client')
      for (const view of ['analytics', 'insights']) {
        await check(`${role} denied ${view}`, async () => {
          const response = await page.goto(
            `${base}/workspace/${role}?view=${view}`,
          )
          assert.equal(response.status(), 404)
        })
      }
    if (role !== 'client') {
      for (const view of views) {
        await page.goto(`${base}/workspace/${role}?view=${view}`)
        assert.equal(
          await page.locator('html').getAttribute('data-theme'),
          'dark',
        )
        assert(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
        )
      }
      await check(`${role}: mobile menu keyboard and close`, async () => {
        await page
          .getByRole('button', { name: 'Открыть меню', exact: true })
          .click()
        await page
          .locator('#workspace-navigation a')
          .first()
          .waitFor({ state: 'visible' })
        await page.keyboard.press('Escape')
        await page
          .getByRole('button', { name: 'Открыть меню', exact: true })
          .waitFor()
      })
    }
    await page.context().close()
  }
  assert.deepEqual(report.errors, [])
  report.status = 'passed'
} catch (e) {
  report.status = 'failed'
  report.failure = e.stack
  console.error(e)
  for (const c of browser.contexts())
    for (const p of c.pages()) {
      await p
        .screenshot({ path: out + '/failure.png', fullPage: true })
        .catch(() => {})
      console.log((await p.locator('body').innerText()).slice(0, 1200))
    }
  process.exitCode = 1
} finally {
  await writeFile(out + '/report.json', JSON.stringify(report, null, 2))
  await browser.close()
}
