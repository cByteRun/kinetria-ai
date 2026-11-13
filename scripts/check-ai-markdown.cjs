const assert = require('node:assert/strict')
const fs = require('node:fs')
const Module = require('node:module')
const path = require('node:path')
const ts = require('typescript')
const React = require('react')
const { renderToStaticMarkup } = require('react-dom/server')
const filename = path.resolve('components/ai-markdown.tsx')
const output = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
}).outputText
const component = new Module(filename, module)
component.filename = filename
component.paths = Module._nodeModulePaths(path.dirname(filename))
component._compile(output, filename)
const text = '# Summary\n\n**Bold** and `tag`\n\n- Item\n\n> Quote\n\n```ts\nconst value = 1\n```\n\n| Topic | State |\n| --- | --- |\n| Test | Done |\n\n- [x] Reviewed\n\n<script>alert(1)</script>\n\n[unsafe](javascript:alert%281%29)\n\n![image](https://untrusted.example/tracker.png)'
const html = renderToStaticMarkup(React.createElement(component.exports.AiMarkdown, { text }))
for (const tag of ['h1','strong','code','ul','blockquote','pre','table']) assert.ok(html.includes('<' + tag), tag)
assert.ok(html.includes('type="checkbox"'))
assert.ok(!html.includes('<script'))
assert.ok(!html.includes('javascript:'))
assert.ok(!html.includes('<img'))
assert.ok(!html.includes('tracker.png'))
console.log('PASS Markdown headings/lists/code/quotes/GFM tables/tasks; no HTML, script URLs or remote images')
