import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { readFile } from 'node:fs/promises'
const require = createRequire(process.cwd() + '/package.json')
const { createClient } = require('@supabase/supabase-js'),
  ts = require('typescript')
const { pathToFileURL } = await import('node:url')
const { chromium } = await import(
  process.env.PLAYWRIGHT_MODULE
    ? pathToFileURL(process.env.PLAYWRIGHT_MODULE).href
    : 'playwright'
)
const base = process.env.P0_BASE_URL || 'http://localhost:3000'
async function moduleUrl(name) {
  let source = await readFile(
    new URL('file://' + process.cwd() + '/lib/' + name + '.ts'),
    'utf8',
  )
  for (const match of [...source.matchAll(/from '(\.\/[^']+)'/g)])
    source = source.replace(
      match[0],
      `from '${await moduleUrl(match[1].slice(2))}'`,
    )
  return (
    'data:text/javascript;base64,' +
    Buffer.from(
      ts.transpileModule(source, {
        compilerOptions: {
          module: ts.ModuleKind.ESNext,
          target: ts.ScriptTarget.ES2022,
        },
      }).outputText,
    ).toString('base64')
  )
}
const { recurrenceSummary } = await import(await moduleUrl('insights'))
const browser = await chromium.launch({
  headless: true,
  ...(process.env.PLAYWRIGHT_EXECUTABLE_PATH
    ? { executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH }
    : {}),
  args: ['--no-sandbox'],
})
const sets = {}
try {
  for (const [account, role] of [
    ['employee', 'employee'],
    ['handler-catalog', 'handler'],
    ['manager-it', 'manager'],
    ['admin', 'admin'],
    ['client', 'client'],
  ]) {
    const db = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
      { auth: { persistSession: false } },
    )
    const { data: auth, error: authError } =
      await db.auth.signInWithPassword({
        email: account + '@kinetria.example',
        password: process.env.KINETRIA_DEMO_PASSWORD,
      })
    assert.ifError(authError)
    const { data: rows, error } = await db
      .from('requests')
      .select(
        'id,author_id,assignee_id,category_id,kind,status,decision,due_at,tags,priority',
      )
    assert.ifError(error)
    sets[role] = new Set(rows.map((r) => r.id))
    if (role === 'client') assert.equal(rows.length, 0)
    if (role === 'employee')
      assert(rows.every((r) => r.author_id === auth.user.id))
    if (role === 'handler')
      assert(rows.every((r) => r.assignee_id === auth.user.id))
    console.log('PASS direct Data API RLS', role, rows.length)
    if (!['manager', 'handler', 'admin'].includes(role)) continue
    const context = await browser.newContext()
    const page = await context.newPage()
    await page.goto(base + '/login')
    await page
      .locator(`button[data-account="${account}"]`)
      .click()
    await page.waitForURL('**/workspace/' + role + '?view=*')
    await page.goto(base + '/workspace/' + role + '?view=insights')
    const summary = recurrenceSummary(rows)
    const expected = [
      summary.groups.length,
      summary.recurring,
      summary.results,
      summary.overdue,
    ].map(String)
    assert.deepEqual(
      await page
        .locator('.ir-metric-grid .metric-value')
        .allTextContents(),
      expected,
    )
    console.log(
      'PASS insights UI equals RLS-scoped Data API',
      role,
      expected,
    )
    const topic = page.locator('.recurrence-topic .chart-bar').first()
    if (await topic.count()) {
      await page.getByLabel('Период аналитики').selectOption('7')
      const first = page.locator('.recurrence-topic .chart-bar').first()
      if (await first.count()) {
        await first.click()
        await page.waitForURL(
          (url) =>
            url.searchParams.get('period') === '7' &&
            Boolean(url.searchParams.get('tag')),
        )
        await page.locator('.registry-group summary').first().click()
        const group = page.locator('.registry-group').first()
        assert(
          (await group.locator('.group-count strong').innerText()) ===
            String(await group.locator('tbody tr').count()),
        )
        console.log('PASS chart → filtered registry group', role)
      }
    }
    await context.close()
  }
  assert([...sets.handler].every((id) => sets.manager.has(id)))
  assert([...sets.manager].every((id) => sets.admin.has(id)))
  assert(
    sets.admin.size > sets.manager.size,
    'Admin scope includes other categories',
  )
  console.log(
    'PASS role scopes and chart counts confirmed with real Data API reads',
  )
} finally {
  await browser.close()
}
