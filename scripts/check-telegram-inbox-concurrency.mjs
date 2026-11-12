// Isolated schema, real concurrent PostgreSQL sessions, no domain data or network APIs.
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { spawn } from 'node:child_process'
const schema = `telegram_inbox_test_${process.pid}`
const migration = (await readFile(new URL('../supabase/migrations/20261112181447_telegram_async_inbox.sql',import.meta.url),'utf8')).replaceAll('public.',schema+'.')
async function sql(query) {
 return new Promise((resolve,reject)=>{
  const child=spawn('docker',['exec','-i',process.env.TELEGRAM_TEST_DB||'supabase_db_modus_IDEA','psql','-XqAt','-v','ON_ERROR_STOP=1','-U','postgres','-d','postgres'])
  let output='',errors=''
  child.stdout.on('data',data=>{output+=data});child.stderr.on('data',data=>{errors+=data})
  child.on('error',reject);child.on('exit',code=>code===0?resolve(output.trim()):reject(new Error(errors)))
  child.stdin.end(query)
 })
}
try {
 await sql(`create schema ${schema};\n${migration}`)
 // 10 connections admitting 100 users, each update submitted twice.
 await Promise.all(Array.from({length:10},(_,worker)=>sql(Array.from({length:10},(_,i)=>{
  const id=worker*10+i+1
  return `select ${schema}.telegram_enqueue(${id},${990000+id},'{"update_id":${id}}');select ${schema}.telegram_enqueue(${id},${990000+id},'{}');`
 }).join('\n'))))
 assert.equal(Number(await sql(`select count(*) from ${schema}.telegram_inbox;`)),100)
 const claimed=[]
 for(let batch=0;batch<10;batch++) {
  const results=await Promise.all(Array.from({length:10},()=>sql(`select ${schema}.telegram_inbox_claim(10);`)))
  for(const result of results) claimed.push(...JSON.parse(result))
  if(claimed.length===100)break
 }
 assert.equal(claimed.length,100);assert.equal(new Set(claimed.map(job=>job.id)).size,100,'Concurrent workers must never share a lease')
 // Ten pending messages of one chat: only the head can execute.
 await sql(Array.from({length:10},(_,i)=>`select ${schema}.telegram_enqueue(${101+i},991001,'{}');`).join('\n'))
 const sameChat=await Promise.all(Array.from({length:10},()=>sql(`select ${schema}.telegram_inbox_claim(10);`)))
 assert.equal(sameChat.flatMap(JSON.parse).length,1)
 const rates=await Promise.all(Array.from({length:20},(_,i)=>sql(`select ${schema}.telegram_api_slot('${992000+i}');`)))
 // Process startup may take multiple slots; each DB timestamp must respect spacing.
 const sameRates=await Promise.all(Array.from({length:10},()=>sql(`select ${schema}.telegram_api_slot('993001');`)))
 assert(sameRates.filter(value=>Number(value)===0).length<=1,'One chat admits at most one call during the burst')
 assert(rates.some(value=>Number(value)>0),'Shared global limiter must defer concurrent callers')
 console.log('PASS real PostgreSQL concurrency: 100 users / duplicate admission, 10 workers, unique leases, same-chat serialization, shared rate limiting; isolated schema removed')
} finally {await sql(`drop schema if exists ${schema} cascade;`)}
