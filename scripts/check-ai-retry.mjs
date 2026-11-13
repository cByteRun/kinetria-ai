import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import ts from 'typescript'
const code = ts.transpileModule(await readFile(new URL('../lib/ai-request.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText
const { requestGroqText, retryAfterSeconds, AiProviderError } = await import('data:text/javascript;base64,' + Buffer.from(code).toString('base64'))
const original = { fetch: globalThis.fetch, setTimeout: globalThis.setTimeout, warn: console.warn }
let calls, waits, logs, queue
globalThis.fetch = async () => { calls++; const value = queue.shift(); if (value instanceof Error) throw value; return value }
globalThis.setTimeout = (fn, ms) => { waits.push(ms); fn(); return 0 }
console.warn = (...args) => logs.push(args)
const ok = () => Response.json({ choices: [{ finish_reason: 'stop', message: { content: 'summary' } }] })
const reset = responses => { queue = responses; calls = 0; waits = []; logs = [] }
try {
 assert.equal(retryAfterSeconds('1.2'), 2)
 assert.equal(retryAfterSeconds('garbage'), undefined)
 assert.equal(retryAfterSeconds(null), undefined)
 assert.equal(retryAfterSeconds(''), undefined)
 assert(retryAfterSeconds(new Date(Date.now() + 60000).toUTCString()) >= 59)
 reset([ok()]); assert.equal(await requestGroqText('secret', { text: 'private' }), 'summary'); assert.equal(calls, 1)
 for (const first of [new Response('', { status: 503 }), new Error('private network detail'), Response.json({ choices: [{ finish_reason: 'length', message: { content: 'partial' } }] }), new Response('', { status: 429, headers: { 'retry-after': '1' } })]) {
  reset([first, ok()]); assert.equal(await requestGroqText('secret', { text: 'private' }), 'summary'); assert.equal(calls, 2); assert.deepEqual(waits, [1000])
  assert(!JSON.stringify(logs).includes('private')); assert(!JSON.stringify(logs).includes('secret'))
 }
 reset([new Response('', { status: 429, headers: { 'retry-after': '45.1' } })])
 await assert.rejects(() => requestGroqText('secret', {}), e => e instanceof AiProviderError && e.reason === 'rate_limit' && e.retryAfterSeconds === 46)
 assert.equal(calls, 1); assert.equal(waits.length, 0)
 reset([new Response('', { status: 429 })])
 await assert.rejects(() => requestGroqText('secret', {}), e => e.retryAfterSeconds === 60); assert.equal(calls, 1)
 for (const status of [400, 401, 403, 404]) {
  reset([new Response('', { status })]); await assert.rejects(() => requestGroqText('secret', {}), e => e.status === status); assert.equal(calls, 1)
 }
 reset([new Error('network'), new Error('network')]); await assert.rejects(() => requestGroqText('secret', {}), e => e.reason === 'network'); assert.equal(calls, 2)
 reset([Response.json({ choices: [] }), Response.json({ choices: [] })]); await assert.rejects(() => requestGroqText('secret', {}), e => e.reason === 'incomplete'); assert.equal(calls, 2)
} finally { globalThis.fetch = original.fetch; globalThis.setTimeout = original.setTimeout; console.warn = original.warn }
console.log('PASS AI retry: transient recovery, two-attempt limit, Retry-After seconds/date, long cooldown, permanent errors, incomplete output and private-data-free logs')
