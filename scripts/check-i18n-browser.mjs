import { pathToFileURL } from 'node:url'
import { readFile, mkdir, writeFile } from 'node:fs/promises'
import assert from 'node:assert/strict'
const { chromium } = await import(
  process.env.PLAYWRIGHT_MODULE
    ? pathToFileURL(process.env.PLAYWRIGHT_MODULE).href
    : 'playwright'
)
const base = process.env.P0_BASE_URL || 'http://localhost:3000'
const output = 'docs/evidence/i18n'
await mkdir(output, { recursive: true })
const browser = await chromium.launch({
  headless: true,
  ...(process.env.PLAYWRIGHT_EXECUTABLE_PATH
    ? { executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH }
    : {}),
  args: ['--no-sandbox'],
})
const report = { checks: [], errors: [] }
const pass = (message) => {
  report.checks.push(message)
  console.log('PASS', message)
}
try {
  for (const locale of ['ru', 'en', 'kk']) {
    const messages = JSON.parse(
      await readFile(`messages/${locale}.json`, 'utf8'),
    )
    const context = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
    })
    const page = await context.newPage()
    page.on('pageerror', (e) => report.errors.push(e.message))
    page.on('console', (m) => {
      if (
        m.type() === 'error' &&
        /MISSING_MESSAGE|FORMATTING_ERROR|INVALID_MESSAGE|hydration/i.test(
          m.text(),
        )
      )
        report.errors.push(m.text())
    })
    await page.goto(base)
    await Promise.all([
      page.waitForResponse(
        (response) =>
          response.request().method() === 'POST' &&
          response.request().headers()['next-action'],
      ),
      page
        .getByRole('button', {
          name: { ru: 'Русский', en: 'English', kk: 'Қазақша' }[locale],
          exact: true,
        })
        .click(),
    ])
    await page.waitForFunction(
      (lang) => document.documentElement.lang === lang,
      locale,
    )
    assert.equal(
      (await context.cookies()).find((c) => c.name === 'kinetria_locale')
        ?.value,
      locale,
    )
    await page.goto(base + '/login')
    assert.equal(await page.locator('html').getAttribute('lang'), locale)
    assert(
      await page
        .getByRole('heading', { name: messages.ui.welcome, exact: true })
        .isVisible(),
    )
    await page.locator('.preferences select').selectOption(locale)
    for (const theme of ['light', 'dark']) {
      if ((await page.locator('html').getAttribute('data-theme')) !== theme)
        await page.locator('.theme-toggle').click()
      await page.waitForFunction(
        (t) => document.documentElement.dataset.theme === t,
        theme,
      )
      await page.reload()
      assert.equal(await page.locator('html').getAttribute('data-theme'), theme)
      assert.equal(
        (await context.cookies()).find((c) => c.name === 'kinetria_theme')
          ?.value,
        theme,
      )
      await page.screenshot({
        path: `${output}/login-${locale}-${theme}.png`,
        fullPage: true,
        caret: 'initial',
      })
    }
    await page.setViewportSize({ width: 320, height: 800 })
    const loginSize = await page.evaluate(() => [
      document.documentElement.scrollWidth,
      document.documentElement.clientWidth,
    ])
    assert(loginSize[0] <= loginSize[1] + 1, `${locale}: login mobile overflow`)
    assert(await page.locator('.preferences select').isVisible())
    assert(await page.locator('.theme-toggle').isVisible())
    await page.screenshot({
      path: `${output}/login-${locale}-320.png`,
      fullPage: true,
      caret: 'initial',
    })
    await page.setViewportSize({ width: 1440, height: 1000 })
    pass(
      `${locale}: landing → login language and theme persist through reload; 320px header`,
    )

    for (const role of ['employee', 'manager', 'handler', 'admin']) {
      await page.locator(`button[data-account="${role}"]`).click()
      await page.waitForURL(`**/workspace/${role}?view=*`)
      await page.locator('.preferences select').waitFor()
      assert.equal(await page.locator('html').getAttribute('lang'), locale)
      const views = [
        'overview',
        'registry',
        'results',
        'notifications',
        'help',
        ...(role === 'employee' ? ['new'] : ['analytics', 'insights']),
        ...(role === 'admin' ? ['categories', 'routing'] : []),
      ]
      for (const view of views) {
        const response = await page.goto(
          `${base}/workspace/${role}?view=${view}`,
        )
        assert.equal(response.status(), 200, `${locale}/${role}/${view}`)
        await page.locator('#main h1').waitFor()
        assert.equal(await page.locator('html').getAttribute('lang'), locale)
        const body = await page.locator('#main').innerText()
        assert(
          !body.includes('ui.'),
          `${locale}/${role}/${view}: untranslated key`,
        )
        if (view === 'registry') {
          assert.equal(
            await page
              .locator('[data-request-search]')
              .getAttribute('aria-label'),
            messages.ui.searchRequests,
          )
          if (role === 'admin') {
            const downloading = page.waitForEvent('download')
            await page
              .getByRole('button', { name: messages.ui.exportCsv, exact: true })
              .click()
            const csv = await readFile(await (await downloading).path(), 'utf8')
            const header = csv.split('\r\n')[0]
            for (const label of [
              messages.ui.number,
              messages.ui.status,
              messages.ui.decision,
            ])
              assert(header.includes(label), `${locale}: CSV header ${label}`)
          }
          await page
            .getByRole('button', { name: messages.ui.list, exact: true })
            .click()
          const detail = page.locator('.case-title:visible').first()
          if (await detail.count()) {
            await page.goto(base + (await detail.getAttribute('href')))
            await page.locator('.request-panel h1').waitFor()
            assert(
              await page
                .getByRole('heading', {
                  name: messages.ui.requestHistory,
                  exact: true,
                })
                .isVisible(),
            )
          }
        }
        if (view === 'new') {
          await page
            .getByRole('button', {
              name: messages.ui.fillInManually,
              exact: true,
            })
            .click()
          await page
            .getByRole('button', {
              name: messages.ui.fillInAnExample,
              exact: true,
            })
            .click()
          const draftTitle = await page
            .locator('input[name="title"]')
            .inputValue()
          assert(draftTitle)
          const alternate = locale === 'en' ? 'kk' : 'en'
          await page.locator('.preferences select').selectOption(alternate)
          await page.waitForFunction(
            (lang) => document.documentElement.lang === lang,
            alternate,
          )
          assert.equal(
            await page.locator('input[name="title"]').inputValue(),
            draftTitle,
            'locale switch preserves draft',
          )
          await page.locator('.preferences select').selectOption(locale)
          await page.waitForFunction(
            (lang) => document.documentElement.lang === lang,
            locale,
          )
        }
        if (view === 'categories') {
          await page.locator('details summary').first().click()
          for (const lang of ['ru', 'en', 'kk'])
            assert(
              await page
                .locator(`input[name="name_${lang}"]`)
                .first()
                .isVisible(),
            )
        }
      }
      await page.goto(`${base}/workspace/${role}?view=overview`)
      await page.setViewportSize({ width: 320, height: 800 })
      assert(await page.locator('.preferences select').isVisible())
      const size = await page.evaluate(() => ({
        width: document.documentElement.clientWidth,
        scroll: document.documentElement.scrollWidth,
      }))
      assert(
        size.scroll <= size.width + 1,
        `${locale}/${role}: mobile overflow ${JSON.stringify(size)}`,
      )
      await page.screenshot({
        path: `${output}/${role}-${locale}-320.png`,
        fullPage: true,
        caret: 'initial',
      })
      await page.setViewportSize({ width: 1440, height: 1000 })
      await page.locator('form[action="/auth/logout"] button').click()
      await page.waitForURL('**/login')
      assert.equal(await page.locator('html').getAttribute('lang'), locale)
      pass(
        `${locale}/${role}: all sections, detail, controls and 320px; locale survives logout`,
      )
    }
    await context.close()
  }
  // Invalid stored locale must fall back safely on the server.
  const invalid = await browser.newContext()
  await invalid.addCookies([
    { name: 'kinetria_locale', value: 'unsupported', url: base },
  ])
  const p = await invalid.newPage()
  await p.goto(base + '/login')
  assert.equal(await p.locator('html').getAttribute('lang'), 'ru')
  await invalid.close()
  pass('invalid locale cookie falls back to ru')
  assert.deepEqual(report.errors, [], 'No translation or hydration errors')
  report.status = 'passed'
} catch (error) {
  report.status = 'failed'
  report.failure = error.stack
  console.error(error.message)
  process.exitCode = 1
} finally {
  await writeFile(`${output}/report.json`, JSON.stringify(report, null, 2))
  await browser.close()
}
