import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createTranslator } from 'next-intl'
const locales = ['ru', 'en', 'kk']
const catalogs = await Promise.all(
  locales.map(async (locale) =>
    JSON.parse(
      await readFile(
        new URL(`../messages/${locale}.json`, import.meta.url),
        'utf8',
      ),
    ),
  ),
)
function flatten(value, prefix = '') {
  return Object.entries(value).flatMap(([key, text]) =>
    typeof text === 'string'
      ? [[prefix + key, text]]
      : flatten(text, prefix + key + '.'),
  )
}
const reference = flatten(catalogs[0])
for (const [index, locale] of locales.entries()) {
  const entries = flatten(catalogs[index])
  assert.deepEqual(
    entries.map(([key]) => key).sort(),
    reference.map(([key]) => key).sort(),
    `${locale}: key parity`,
  )
  const t = createTranslator({
    locale,
    messages: catalogs[index],
    onError: (error) => {
      throw error
    },
  })
  for (const [key, message] of entries) {
    assert(message.trim(), `${locale}.${key}: empty translation`)
    // Rich text messages have their own rendering contract; check plain ICU here.
    if (/<[a-z]/i.test(message)) continue
    const variables = Object.fromEntries(
      [...message.matchAll(/\{(\w+)(?:[,}])/g)].map(([, name]) => [
        name,
        name === 'language' || name === 'priority' || name === 'date'
          ? 'test'
          : 2,
      ]),
    )
    assert(t(key, variables).length, `${locale}.${key}: valid ICU`)
    const base = reference.find(([k]) => k === key)[1]
    assert.deepEqual(
      [...message.matchAll(/\{(\w+)(?:[,}])/g)].map((m) => m[1]).sort(),
      [...base.matchAll(/\{(\w+)(?:[,}])/g)].map((m) => m[1]).sort(),
      `${locale}.${key}: placeholders`,
    )
  }
  assert(
    t('ui.countRequests', { count: 1 }) !== t('ui.countRequests', { count: 5 }),
  )
  console.log(
    `PASS ${locale}: ${entries.length} messages, ICU, placeholders, plural counts`,
  )
}
const months = JSON.parse(
  await readFile(
    new URL('../messages/date-months.json', import.meta.url),
    'utf8',
  ),
)
for (const locale of locales)
  assert.equal(months[locale].length, 12, `${locale}: month names`)
// Guard against repeating the regression: display literals belong in catalogs.
const ts = (await import('typescript')).default
const { readdir } = await import('node:fs/promises')
async function sources(directory) {
  const files = await readdir(directory, { withFileTypes: true })
  return (
    await Promise.all(
      files.map((entry) =>
        entry.isDirectory()
          ? sources(directory + '/' + entry.name)
          : entry.name.endsWith('.tsx')
            ? [directory + '/' + entry.name]
            : [],
      ),
    )
  ).flat()
}
const adapters = new Set([
  'Резервная очередь · администратор',
  'Руководитель направления',
  'Ответственный специалист',
  'Резервная очередь',
  'Сотрудник',
  'Назначен ответственный из резервной очереди',
])
for (const file of [
  ...(await sources('app')),
  ...(await sources('components')),
]) {
  const source = ts.createSourceFile(
    file,
    await readFile(file, 'utf8'),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  )
  function check(node) {
    if (ts.isJsxText(node))
      assert(!/[А-Яа-яЁё]/.test(node.text), `${file}: hardcoded JSX text`)
    if (ts.isStringLiteral(node) && /[А-Яа-яЁё]/.test(node.text)) {
      assert(
        adapters.has(node.text) ||
          (file === 'components/preferences.tsx' &&
            ['Русский', 'Қазақша'].includes(node.text)),
        `${file}: hardcoded UI literal ${node.text}`,
      )
    }
    ts.forEachChild(node, check)
  }
  check(source)
}
console.log('PASS UI source literals and explicit month catalogs')
