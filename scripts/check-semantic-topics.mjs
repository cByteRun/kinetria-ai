import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import ts from 'typescript'
const url = s => 'data:text/javascript;base64,' + Buffer.from(s).toString('base64')
const compile = s => url(ts.transpileModule(s,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText)
let calls=0
const cache=new Map()
globalThis.topicHarness={cache:(fn,keys)=>async()=>{const key=JSON.stringify(keys);if(!cache.has(key))cache.set(key,await fn());return cache.get(key)},generate:async()=>{calls++;return JSON.stringify({topics:[{title:'VPN disconnects',ids:['a','b']}]})}}
const source=await readFile(new URL('../lib/semantic-topics.ts',import.meta.url),'utf8')
const {validateTopics,semanticTopics}=await import(compile(source.replace("'next/cache'",`'${url('export const unstable_cache=globalThis.topicHarness.cache')}'`).replace("'./ai'",`'${url('export const aiConfig=()=>({provider:"groq",model:"test"});export const generateText=globalThis.topicHarness.generate')}'`)))
const anchor=Date.parse('2026-11-13T12:00:00Z'), day=86400000
const rows=[{id:'a',title:'VPN drops',description:'Morning disconnections',created_at:new Date(anchor-day).toISOString()},{id:'b',title:'Cannot connect remotely',description:'VPN connection lost before work',created_at:new Date(anchor-8*day).toISOString()}]
assert.deepEqual(await semanticTopics(rows,7,'en',anchor),[{title:'VPN disconnects',ids:['a'],current:1,previous:1}])
await semanticTopics(rows,7,'en',anchor);assert.equal(calls,1,'Reopening same input must use cache')
await semanticTopics(rows.map(r=>({...r,title:r.title+'!'})),7,'en',anchor);assert.equal(calls,2,'Changed text invalidates cache')
assert.deepEqual(await semanticTopics([rows[0]],7,'en',anchor),[],'Changed access cannot return earlier cluster')
for(const ids of [['a','unknown'],['a','a'],['a']]) assert.throws(()=>validateTopics({topics:[{title:'VPN',ids}]},rows,anchor-7*day))
assert.throws(()=>validateTopics({topics:[{title:'VPN',ids:['a','b']},{title:'Other',ids:['a','b']}]},rows,anchor-7*day))
assert.throws(()=>validateTopics({topics:[{title:'',ids:['a','b']}]},rows,anchor))
const {requestProgressIndex,statuses}=await import(compile(await readFile(new URL('../lib/requests.ts',import.meta.url),'utf8')))
for(const status of statuses){const index=requestProgressIndex(status);assert(index>=0);if(['implemented','closed','rejected'].includes(status))assert.equal(index,4)}
assert.equal(requestProgressIndex('in_progress'),3)
console.log('PASS semantic topics: period counts, cache hit/invalidation, scope change, fabricated/duplicate/singleton ID rejection; all terminal progress indices')
