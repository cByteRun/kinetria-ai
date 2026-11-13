import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE
  ? pathToFileURL(process.env.PLAYWRIGHT_MODULE).href : 'playwright')
const base = process.env.P0_BASE_URL || 'http://localhost:3000'
const output = 'docs/evidence/performance-review'
const browser = await chromium.launch({ headless: true,
  executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH || undefined,
  args: ['--no-sandbox'],
})
const report = { checks: [], errors: [], timings: [] }
const pass = message => { report.checks.push(message); console.log('PASS', message) }
try {
  const context = await browser.newContext()
  const page = await context.newPage()
  page.on('pageerror', error => report.errors.push(error.message))
  page.on('console', message => {
    if (message.type() === 'error') report.errors.push(message.text())
  })
  const endpoint = base + '/api/preferences/theme'
  for (const [data, headers, status] of [
    [{ theme: 'light' }, { origin: 'https://untrusted.example' }, 403],
    [{ theme: 'invalid' }, { origin: base }, 400],
    [{ theme: 'light' }, { origin: base }, 204],
  ]) assert.equal((await context.request.post(endpoint, { data, headers })).status(), status)
  pass('theme endpoint validates origin and value')

  await context.addCookies([{ name: 'idearoute_color_theme', value: 'purple', url: base }])
  await page.goto(base)
  await page.waitForLoadState('networkidle')
  assert.equal(await page.locator('html').getAttribute('data-theme'), 'light')
  assert.equal(await page.locator('html').getAttribute('data-color-theme'), 'purple')
  assert.equal(await page.locator('.preferences select').last().inputValue(), 'purple')
  assert.equal(await page.locator('section').count(), 6)
  await page.evaluate(() => { window.__navigationSentinel = 'retained' })
  await page.locator('#roles button').nth(2).click()

  let themeRscRequests = 0
  const trackRsc = request => { if (request.headers().rsc) themeRscRequests++ }
  page.on('request', trackRsc)
  await page.route('**/api/preferences/theme', async route => {
    await new Promise(resolve => setTimeout(resolve, 400))
    await route.continue()
  })
  const saved = page.waitForResponse(response => response.url() === endpoint)
  const started = Date.now()
  await page.locator('.theme-toggle').click()
  assert.equal(await page.locator('html').getAttribute('data-theme'), 'dark')
  report.timings.push({ action: 'theme DOM change with delayed 400ms persistence', ms: Date.now() - started })
  assert.equal((await saved).status(), 204)
  await page.waitForFunction(() => document.querySelector('.preferences')?.getAttribute('aria-busy') === 'false')
  page.off('request', trackRsc)
  assert.equal(themeRscRequests, 0)
  assert.equal(await page.locator('#roles button').nth(2).getAttribute('aria-pressed'), 'true')
  pass('theme changes immediately without RSC refresh or lost role state')

  await page.route('**/api/preferences/theme', route => route.fulfill({ status: 503 }))
  await page.locator('.theme-toggle').click()
  await page.locator('.preferences-error').waitFor()
  assert.equal(await page.locator('html').getAttribute('data-theme'), 'dark')
  // The expected rejected request is checked above; exclude its browser network log.
  report.errors = report.errors.filter(error => !error.includes('503'))
  await page.unroute('**/api/preferences/theme')
  pass('failed theme persistence restores previous DOM and control state')

  for (const locale of ['en', 'kk', 'ru']) {
    await page.locator('.preferences select').first().selectOption(locale)
    await page.waitForFunction(value => document.documentElement.lang === value, locale)
    await page.waitForFunction(() => document.querySelector('.preferences')?.getAttribute('aria-busy') === 'false')
    assert.equal(await page.locator('#roles button').nth(2).getAttribute('aria-pressed'), 'true')
    assert.equal(await page.evaluate(() => window.__navigationSentinel), 'retained')
  }
  pass('RU/EN/KK switch keeps client role state and document')
  await page.reload()
  assert.equal(await page.locator('html').getAttribute('data-theme'), 'dark')
  pass('saved theme survives reload in server HTML')
  const externalFonts = await page.evaluate(() => performance.getEntriesByType('resource')
    .filter(entry => /fonts\.(googleapis|gstatic)\.com/.test(entry.name)).length)
  assert.equal(externalFonts, 0)
  await page.evaluate(() => document.fonts.ready)
  assert.ok((await page.evaluate(() => getComputedStyle(document.body).fontFamily)).includes('inter'))
  pass('fonts load locally through next/font')
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 1000 })
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `overflow ${width}`)
  }
  await page.evaluate(() => { window.__navigationSentinel = 'retained' })
  await page.locator('.new-landing header a[href="/login"]').click()
  await page.waitForURL('**/login')
  assert.equal(await page.evaluate(() => window.__navigationSentinel), 'retained')
  await page.locator('.entry-brand').click()
  await page.waitForURL(base + '/')
  assert.equal(await page.evaluate(() => window.__navigationSentinel), 'retained')
  pass('Link navigation retains document; responsive landing has no overflow')
  assert.deepEqual(report.errors, [])
} finally {
  await mkdir(output, { recursive: true })
  await writeFile(output + '/report.json', JSON.stringify(report, null, 2))
  await browser.close()
}
