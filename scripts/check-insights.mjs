import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import ts from 'typescript'
// Load the actual pure TypeScript modules without adding a test runner dependency.
async function moduleUrl(name) {
  let source = await readFile(new URL('../lib/' + name + '.ts', import.meta.url), 'utf8')
  const imports = [...source.matchAll(/from '(\.\/[^']+)'/g)]
  for (const match of imports) source = source.replace(match[0], `from '${await moduleUrl(match[1].slice(2))}'`)
  return 'data:text/javascript;base64,' + Buffer.from(ts.transpileModule(source, {compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText).toString('base64')
}
const { recurringProblems, normalizeTopic } = await import(await moduleUrl('insights'))
assert.equal(normalizeTopic('  УЧЁТ   ДАННЫХ '), 'учет данных')
const problem = {category_id:'catalog',kind:'problem',tags:['учёт данных','учет данных'],status:'new',due_at:'2020-01-01'}
const rows = [
  {...problem,id:'1'},
  {...problem,id:'2',tags:['УЧЕТ ДАННЫХ'],status:'implemented',decision:'Проверка выполнена'},
  {...problem,id:'3',kind:'idea'},
  {...problem,id:'4',kind:'praise'},
  {...problem,id:'5',category_id:'training'},
  {...problem,id:'6',tags:[]},
]
const groups=recurringProblems(rows)
assert.equal(groups.length,1,'Unrelated categories and non-problems do not create a group')
assert.deepEqual(groups[0].rows.map(r=>r.id),['1','2'],'Equivalent tags count each request once')
assert.equal(groups[0].results,1)
assert.equal(groups[0].overdue,1,'A completed case is never overdue')
assert.deepEqual(recurringProblems([{...problem,tags:['Проблема']},{...problem,tags:['Проблема']}]),[],'Request type tags are excluded')
assert.deepEqual(recurringProblems([rows[0]]),[],'One case is not recurring')
assert.equal(recurringProblems([rows[0],{...rows[1],decision:'  '}])[0].results,0,'Final status without a decision is not a result')
console.log('PASS: normalized topics, unique request counts, category isolation, problem-only grouping, results, overdue, no false recurrence')
