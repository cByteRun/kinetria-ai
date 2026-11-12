import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ? pathToFileURL(process.env.PLAYWRIGHT_MODULE).href : 'playwright')
const base = process.env.P0_BASE_URL || 'http://localhost:3000'
const output = 'docs/evidence/entry-review'
await mkdir(output, { recursive: true })
const browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_EXECUTABLE_PATH ? { executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH } : {}), args: ['--no-sandbox'] })
const checks = [], errors = []
const pass = label => { checks.push(label); console.log('PASS', label) }
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1050 } })
  const page = await context.newPage()
  page.on('pageerror', error => errors.push(error.message))
  await page.goto(base + '/login')
  await page.locator('.login-account-list').waitFor()
  const accounts = [
    ['employee', 'employee', 'new', 'Алина Соколова'],
    ['manager', 'manager', 'registry', 'Алексей Волков'],
    ['manager-it', 'manager', 'registry', 'Максим Ли'],
    ['manager-people', 'manager', 'registry', 'Елена Морозова'],
    ['handler', 'handler', 'registry', 'Дмитрий Орлов'],
    ['handler-catalog', 'handler', 'registry', 'Мария Ким'],
    ['handler-training', 'handler', 'registry', 'Ирина Белова'],
    ['admin', 'admin', 'routing', 'Анна Кузнецова'],
    ['client', 'client', 'overview', 'Сергей Павлов'],
  ]
  assert.equal(await page.locator('.login-account-group').count(), 5)
  assert.equal(await page.locator('details,summary,[role="tab"]').count(), 0)
  for (const [account] of accounts) assert(await page.locator(`[data-account="${account}"]`).isVisible(), account)
  assert.equal(await page.locator('.login-lifecycle > li').count(), 3)
  assert.equal(await page.locator('.login-telegram ol > li').count(), 3)
  assert(await page.locator('.login-email input[type="email"]').isDisabled())
  assert(await page.locator('.login-email input[type="password"]').isDisabled())
  pass('All nine accounts visible, lifecycle and Telegram have three steps, corporate fields disabled')
  for (const theme of ['light', 'dark']) {
    await page.evaluate(theme => document.documentElement.dataset.theme = theme, theme)
    await page.waitForTimeout(250)
    for (const width of [320, 390, 768, 1440]) {
      await page.setViewportSize({ width, height: 1050 })
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${theme} ${width}: overflow`)
      if (theme === 'dark') assert.equal(await page.locator('.entry-page').evaluate(el => getComputedStyle(el).backgroundColor), 'rgb(23, 21, 31)')
      await page.screenshot({ path: `${output}/${theme}-${width}.png`, fullPage: true })
    }
  }
  pass('320/390/768/1440 px, light and dark, no horizontal overflow and correct dark surface')
  await page.setViewportSize({ width: 1440, height: 1050 })
  for (const [account, role, view, name] of accounts) {
    await page.goto(base + '/login')
    await page.locator(`[data-account="${account}"]`).click()
    await page.waitForURL(`**/workspace/${role}?view=${view}`)
    await page.getByRole('link', { name: 'Сменить роль', exact: true }).click()
    await page.waitForURL('**/login')
    assert((await page.locator('.entry-session').innerText()).includes(name))
    pass(`One-click ${account} → ${role}/${view}; real profile and switch without logout`)
  }
  await page.goto(base + '/login')
  await page.locator('[data-account="employee"]').click()
  await page.waitForURL('**/workspace/employee?view=new')
  await page.goto(base + '/login')
  await page.locator('.login-telegram-link').click()
  await page.waitForURL('**/workspace/employee?view=help')
  assert(await page.locator('section').filter({has:page.getByRole('heading',{name:'Telegram',exact:true})}).getByRole('button').isVisible())
  pass('Telegram instruction opens the actual connection control in Help')
  await context.close()
  const plain = await browser.newContext({ javaScriptEnabled: false })
  const native = await plain.newPage()
  await native.goto(base + '/login')
  await native.locator('[data-account="manager-it"]').click()
  await native.waitForURL('**/workspace/manager?view=registry')
  await native.goto(base + '/login')
  await native.locator('[data-account="handler-catalog"]').click()
  await native.waitForURL('**/workspace/handler?view=registry')
  await plain.close()
  pass('Native POST and account switching work without JavaScript')
  assert.deepEqual(errors, [])
  pass('No browser runtime errors')
} finally {
  await writeFile(`${output}/report.json`, JSON.stringify({ checks, errors }, null, 2))
  await browser.close()
}
